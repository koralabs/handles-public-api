import { ApiIndexType, Holder, IApiMetrics, IApiStore, IHandleFileContent, IndexNames, ISlotHistory, LogCategory, Logger, NETWORK, StoredHandle } from '@koralabs/kora-labs-common';
import { GlideClient } from '@valkey/valkey-glide';
import runSync from 'make-synchronous';
import { promisify } from 'util';
import { inflate } from 'zlib';
import { DISABLE_HANDLES_SNAPSHOT, isDatumEndpointEnabled, NODE_ENV } from '../../config';
import { RewoundHandle } from '../../repositories/handlesRepository';

export class RedisHandlesProvider implements IApiStore {
    private static client: GlideClient | undefined = undefined;

    // #region SETUP **************************
    public async initialize(): Promise<IApiStore> {
        // initialize valkey/redis
        if (!RedisHandlesProvider.client){
            RedisHandlesProvider.client = await GlideClient.createClient({
                addresses: [{host: process.env.REDIS_HOST ?? 'localhost'}],
                // if the server uses TLS, you'll need to enable it. Otherwise, the connection attempt will time out silently.
                useTLS: process.env.REDIS_USE_TLS == 'true'
            });
        }
        return this;
    }

    public destroy(): void {
        RedisHandlesProvider.client = undefined;
    }

    public rollBackToGenesis(): void {
        Logger.log({ message: 'Rolling back to genesis', category: LogCategory.INFO, event: 'this.rollBackToGenesis' });
        // Clear all redis cache
        runSync(RedisHandlesProvider.client!.flushall)();
    }

    public async getStartingPoint(save: (handle: StoredHandle) => void, failed = false): Promise<{ slot: number; id: string; } | null> {
        if (!failed) {
            //connect to redis and get currentSlot and currentBlockHash
            return { slot: 0, id: '' }
        }
        else {
            if (NODE_ENV === 'local' || DISABLE_HANDLES_SNAPSHOT == 'true') {
                return null;
            }
            
            try {
                const fileName = isDatumEndpointEnabled() ? 'handles.gz' : 'handles-no-datum.gz';
                const url = `http://api.handle.me.s3-website-us-west-2.amazonaws.com/${NETWORK}/snapshot/${this.getSchemaVersion()}/${fileName}`;
                Logger.log(`Fetching ${url}`);
                const awsResponse = await fetch(url);
                if (awsResponse.status === 200) {
                    const buff = await awsResponse.arrayBuffer();
                    const unZipPromise = promisify(inflate);                
                    const result = await unZipPromise(buff);
                    const text = result.toString('utf8');
                    Logger.log(`Found ${url}`);
                    const storedS3HandlesJson = JSON.parse(text) as IHandleFileContent;
                    const { handles, slot, hash, history } = storedS3HandlesJson;
                    
                    // save all the individual handles to the store
                    for (let i = 0; i < handles.length; i++) {
                        // clone it
                        const newHandle = { ...handles[i] };
                        save(new RewoundHandle(newHandle));
                    }
                    
                    // save the slot history to the store
                    RedisHandlesProvider.client!.del([IndexNames.SLOT_HISTORY])
                    await RedisHandlesProvider.client!.zadd(IndexNames.SLOT_HISTORY, history.map(([slot, hist]) => ({score: slot, element: JSON.stringify(hist)})));
                    Logger.log(`Handle storage found at slot: ${slot} and hash: ${hash} with ${Object.keys(handles ?? {}).length} handles and ${history?.length} history entries`);
                }
            
                Logger.log(`Unable to find ${url} online`);
                return null;
            } catch (error: any) {
                Logger.log(`Error fetching file from online with error: ${error.message}`);
                return null;
            }
            
        }
    }

    // #endregion

    // #region HANDLES ************************
    public getHandle(key: string): StoredHandle | null {
        const handle = runSync(this.rehydrateObjectFromCache)(`${IndexNames.HANDLE}:${key}`);
        return structuredClone(handle) as StoredHandle;
    }

    public getHandleByHex(hex: string): StoredHandle | null {
        const handle = this.getHandle(this.getValueFromIndex(IndexNames.HEX, hex) as string);
        return this.returnHandleWithDefault(handle);
    }

    public getAllHandles(): StoredHandle[] {
        const handleNames = runSync(RedisHandlesProvider.client!.smembers)(IndexNames.HANDLE);
        const handles: StoredHandle[] = [];
        for (const name in handleNames) {
            const handle = this.getHandle(name);
            if (handle)
                handles.push(handle);
        }
        return handles;
    }

    public setHandle(key: string, value: StoredHandle): void {
        runSync(this.saveObjectToCache)(`${IndexNames.HANDLE}:${key}`, value);
        this.setValueOnIndex(IndexNames.HEX, value.hex, key);
        runSync(RedisHandlesProvider.client!.sadd)(IndexNames.HANDLE, [key]);
    }

    public removeHandle(key: string): void {
        const handle = this.getHandle(key);
        runSync(this.removeObjectAndDescendents)(`${IndexNames.HANDLE}:${key}`, handle);
        runSync(RedisHandlesProvider.client!.srem)(IndexNames.HANDLE, [key]);
    }

    // #endregion

    // #region INDEXES *************************
    public getIndex(index: IndexNames): Map<string | number, ApiIndexType> {
        // SLOT_HISTORY uses a an ordered set (ZSET)
        if (index == IndexNames.SLOT_HISTORY) { 
            return runSync(RedisHandlesProvider.client!.zrangeWithScores)(IndexNames.SLOT_HISTORY, {start: 0, end: -1})
                .reduce((acc: Map<number, ISlotHistory>, value) => {
                    acc.set(value.score, JSON.parse(value.element.toString()) as ISlotHistory);
                    return acc;
                }, new Map<number, ISlotHistory>());
        }
        const keys = runSync(RedisHandlesProvider.client!.smembers)(index);
        const values: Map<string | number, ApiIndexType> = new Map<string | number, ApiIndexType>();
        for (const key in keys) {
            const value = this.getValueFromIndex(index, key);
            if (value)
                values.set(key, value);
        }
        return values;
    }

    public getKeysFromIndex(index:IndexNames): (string|number)[] {
        return Array.from(runSync(RedisHandlesProvider.client!.smembers)(index)).map(v => !isNaN(Number(v.toString())) ? Number(v.toString()) : v.toString())
    }

    public getValueFromIndex(index: IndexNames, key: string | number): ApiIndexType | undefined {
        return runSync(this.rehydrateObjectFromCache)(`${index}:${key}`);
    }

    public setValueOnIndex(index: IndexNames, key: string | number, value: ApiIndexType): void {
        // SLOT_HISTORY uses a an ordered set (ZSET)
        if (index == IndexNames.SLOT_HISTORY) { 
            runSync(RedisHandlesProvider.client!.zadd)(IndexNames.SLOT_HISTORY, [{element: JSON.stringify(value), score: key as number}]);
        }
        runSync(this.saveObjectToCache)(`${index}:${key}`, value)

    }

    public removeKeyFromIndex(index: IndexNames, key: string | number): void {
        // SLOT_HISTORY uses a an ordered set (ZSET)
        if (index == IndexNames.SLOT_HISTORY) { 
             runSync(RedisHandlesProvider.client!.zremRangeByScore)(IndexNames.SLOT_HISTORY, {value: key as number}, {value: key as number});
        }
        runSync(RedisHandlesProvider.client!.del)([`${index}:${key}`])
    }

    // #endregion

    // #region SET INDEXES ************************
    public getValuesFromIndexedSet(index: IndexNames, key: string | number): Set<string> | undefined {
        return new Set([...runSync(RedisHandlesProvider.client!.smembers)(`${index}:${key}`)].map(v => v.toString()))
    }

    public addValueToIndexedSet(index: IndexNames, key: string | number, value: string): void {
        runSync(RedisHandlesProvider.client!.sadd)(`${index}:${key}`, [value])
    }

    public removeValueFromIndexedSet(index: IndexNames, key: string | number, value: string): void {
        runSync(RedisHandlesProvider.client!.srem)(`${index}:${key}`, [value])
    }

    // #endregion

    // #region METRICS *****************************
    public getMetrics(): IApiMetrics {
        const metrics = runSync(RedisHandlesProvider.client!.hgetall)("metrics") as IApiMetrics;
        metrics.count = this.count();
        return metrics;        
    }

    public setMetrics(metrics: IApiMetrics): void {
        this.saveObjectToCache("metrics", { ...this.getMetrics(), ...metrics });
    }

    public count(): number {
        return runSync(RedisHandlesProvider.client!.scard)(IndexNames.HANDLE);
    }

    public getSchemaVersion(): number {
        return Number(process.env.STORAGE_SCHEMA_VERSION);
    }

    // #endregion

    // #region PRIVATE *******************************
    private returnHandleWithDefault(handle?: StoredHandle | null) {
        if (!handle) {
            return null;
        }
    
        const holder = this.getValueFromIndex(IndexNames.HOLDER, handle.holder) as Holder;
        if (holder) {
            handle.default_in_wallet = holder.defaultHandle;
        }
    
        return handle;
    }

    private async saveObjectToCache(key: string, obj: any) {
        const parentFields: Record<string, string> = {};
        for (const [field, value] of Object.entries(obj)) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                // JSON value → add to parent hash
                parentFields[field] = JSON.stringify(value) 
            } else {
                // Primitive value → add to parent hash
                parentFields[field] =  String(value);
            }
        }
        if (Object.keys(parentFields).length > 0) {
            await RedisHandlesProvider.client!.hset(key, parentFields);
        }
    }

    private async rehydrateObjectFromCache(key: string): Promise<Record<string, any>> {
        const result: Record<string, any> = {};
        const fields = await RedisHandlesProvider.client!.hgetall(key);
        for (const {field, value} of Object.values(fields)) {
            if (value.toString() == `${key}:${field}`)
                result[field.toString()] = this.rehydrateObjectFromCache(`${key}:${field}`)
            else {
                try { // This covers object, boolean, number
                    result[field.toString()] = JSON.parse(value.toString());
                }
                catch {
                    result[field.toString()] = value.toString();
                }
            }
        }
        return result;
    }

    private scanDescendentKeys(key: string, obj:any, keys: Set<string>) {
        keys.add(key);

        for (const [field, value] of Object.entries(obj)) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const childKey = `${key}:${field}`;
                this.scanDescendentKeys(childKey, value as Record<string, any>, keys);
            }
        }

    }

    private async removeObjectAndDescendents(key: string, obj: any): Promise<void> {
        const keys = new Set<string>();
        this.scanDescendentKeys(key, obj, keys);
        const ordered = [...keys].sort((a, b) => b.length - a.length);

        if (ordered.length > 0) {
            await RedisHandlesProvider.client!.del(ordered);
        }

    }

    // #endregion
}