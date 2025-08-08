import { Holder, IApiMetrics, IHandleFileContent, IHandlesProvider, IndexNames, ISlotHistory, LogCategory, Logger, NETWORK, StoredHandle } from '@koralabs/kora-labs-common';
import { GlideClient } from '@valkey/valkey-glide';
import { promisify } from 'util';
import { inflate } from 'zlib';
import { DISABLE_HANDLES_SNAPSHOT, NODE_ENV } from '../../config';
import { RewoundHandle } from '../handlesRepository';

export class RedisHandlesProvider implements IHandlesProvider {
    private static client: GlideClient | undefined = undefined;

    /********* SETUP *************/
    public async initialize(): Promise<IHandlesProvider> {
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

    }

    public async getStartingPoint(save: (handle: StoredHandle) => Promise<void>, failed = false): Promise<{ slot: number; id: string; } | null> {
        if (!failed) {
            //connect to redis and get currentSlot and currentBlockHash
            return { slot: 0, id: '' }
        }
        else {
            if (NODE_ENV === 'local' || DISABLE_HANDLES_SNAPSHOT == 'true') {
                return null;
            }
            
            try {
                const url = `http://api.handle.me.s3-website-us-west-2.amazonaws.com/${NETWORK}/snapshot/${this._storageSchemaVersion}/${fileName}`;
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
                        await save(new RewoundHandle(newHandle));
                    }
                    
                    // save the slot history to the store
                    HandleStore.slotHistoryIndex = new Map(history);
                    
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

    /********* HANDLES ************/
    public getHandle(key: string): StoredHandle | null {
        const handle = structuredClone(RedisHandlesProvider.client!.handles.get(key));

        return this.returnHandleWithDefault(handle);

    }

    public getHandleByHex(hex: string): StoredHandle | null {
        let handle: StoredHandle | null = null;
        for (const [ , value] of HandleStore.handles.entries()) {
            if (value.hex === hex) handle = structuredClone(value);
            break;
        }
        return this.returnHandleWithDefault(handle);

    }

    public getAllHandles(): StoredHandle[] {
        return Array.from(HandleStore.handles).map(([,handle]) => this.returnHandleWithDefault(structuredClone(handle)) as StoredHandle);
    }

    public setHandle(key: string, value: StoredHandle): void {
        this.saveObjectToGlide(`${IndexNames.HANDLE}:${key}`, value)
    }

    public removeHandle(key: string): void {
        const handle = this.getHandle(key);
        this.removeObjectAndDescendents(`${IndexNames.HANDLE}:${key}`, handle)
    }

    /********* INDEXES *************/
    public getIndex(index: IndexNames): Map<string | number, Set<string> | Holder | ISlotHistory | StoredHandle> {

    }

    public getValueFromIndex(index: IndexNames, key: string | number): Set<string> | Holder | ISlotHistory | StoredHandle | undefined {

    }

    public setValueOnIndex(index: IndexNames, key: string | number, value: Set<string> | Holder | ISlotHistory | StoredHandle): void {

    }

    public removeKeyFromIndex(index: IndexNames, key: string | number): void {

    }


    /******* SET INDEXES ***********/
    public getValuesFromIndexedSet(index: IndexNames, key: string | number): Set<string> | undefined {

    }

    public addValueToIndexedSet(index: IndexNames, key: string | number, value: string): void {

    }

    public removeValueFromIndexedSet(index: IndexNames, key: string | number, value: string): void {

    }


    /********* METRICS *************/
    public getMetrics(): IApiMetrics {

    }

    public setMetrics(metrics: IApiMetrics): void {

    }

    public count(): number {

    }

    public getSchemaVersion(): number {
        return Number(process.env.STORAGE_SCHEMA_VERSION);
    }

    /********* PRIVATE *************/
    private returnHandleWithDefault(handle?: StoredHandle | null) {
        if (!handle) {
            return null;
        }
    
        const holder = HandleStore.holderIndex.get(handle.holder);
        if (holder) {
            handle.default_in_wallet = holder.defaultHandle;
        }
    
        return handle;
    }

    private async saveObjectToGlide(key: string, obj: any) {
        const parentFields: Record<string, string> = {};

        for (const [field, value] of Object.entries(obj)) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                // Nested object → store as its own hash
                await this.saveObjectToGlide(`${key}:${field}`, value);
            } else {
                // Primitive value → add to parent hash
                parentFields[field] = String(value);
            }
        }

        if (Object.keys(parentFields).length > 0) {
            await RedisHandlesProvider.client!.hset(key, parentFields);
        }

    }

    private findDescendentKeys(key: string, obj:any, keys: Set<string>) {
        keys.add(key);

        for (const [field, value] of Object.entries(obj)) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const childKey = `${key}:${field}`;
                this.findDescendentKeys(childKey, value as Record<string, any>, keys);
            }
        }

    }

    private async removeObjectAndDescendents(key: string, obj:any): Promise<void> {
        const keys = new Set<string>();
        this.findDescendentKeys(key, obj, keys);
        const ordered = [...keys].sort((a, b) => b.length - a.length);

        if (ordered.length > 0) {
            await RedisHandlesProvider.client!.del(ordered);
        }

    }

}