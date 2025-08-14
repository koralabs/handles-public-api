import { ApiIndexType, IApiMetrics, IApiStore, IHandleFileContent, IndexNames, ISlotHistory, LogCategory, Logger, NETWORK, Sort, StoredHandle } from '@koralabs/kora-labs-common';
import { Boundary, GlideString, HashDataType, Limit, SortOptions } from '@valkey/valkey-glide';
import { promisify } from 'util';
import { MessageChannel, receiveMessageOnPort, Worker } from 'worker_threads';
import { inflate } from 'zlib';
import { DISABLE_HANDLES_SNAPSHOT, isDatumEndpointEnabled, NODE_ENV } from '../../config';
import { handleEraBoundaries } from '../../config/constants';
import { RewoundHandle } from '../../repositories/handlesRepository';

const INDEXES_IGNORE_ROOT = [IndexNames.ADDRESS, IndexNames.HASH_OF_STAKE_KEY_HASH, IndexNames.PAYMENT_KEY_HASH, IndexNames.SLOT, IndexNames.SLOT_HISTORY]

// const glideClient = await GlideClient.createClient({
//       addresses: [{ host: 'https://localhost', port: 6379 }],
//       useTLS: process.env.REDIS_USE_TLS ? process.env.REDIS_USE_TLS == 'true' : true
// });

// glideClient.zremRangeByScore('', {value: 0, isInclusive: true})

const bound = (val: string | number): Boundary<string | number> => ({value: val, isInclusive: true});

export class RedisHandlesStore implements IApiStore {
    private static _worker: any
    private static _id = 0

    // #region SETUP **************************
    public async initialize(): Promise<IApiStore> {
        if (!RedisHandlesStore._worker) {
            const { port1, port2 } = new MessageChannel();
            const worker = new Worker('./workers/redisSync.worker.js', {
                workerData: { port: port2 },
                //@ts-ignore
                transferList: [port2]
            });
            worker.on('error', (e) => Logger.log({ message: `Error: ${e}`, category: LogCategory.ERROR, event: "ValkeySyncWorker.Error" }));
            worker.on('exit', (e) => Logger.log({ message: `Error: ${e}`, category: LogCategory.ERROR, event: "ValkeySyncWorker.Exit" }));
            RedisHandlesStore._worker = { worker, port: port1 };
        }
        return this;
    }

    public destroy(): void {

    }

    public rollBackToGenesis(): void {
        Logger.log({ message: 'Rolling back to genesis', category: LogCategory.INFO, event: 'this.rollBackToGenesis' });
        // Clear all redis cache
        this.redisClientCall('flushdb');
    }

    public async getStartingPoint(save: (handle: StoredHandle) => void, failed = false): Promise<{ slot: number; id: string; } | null> {
        if (!failed) {
            const { schemaVersion, currentSlot, currentBlockHash } = this.getMetrics();
            const currentSchemaVersion = this.getSchemaVersion();
            if (currentSchemaVersion > (schemaVersion ?? 0) || !currentBlockHash || !currentSlot) {
                this.redisClientCall('flushdb');
                const { id, slot } = handleEraBoundaries[NETWORK];
                this.setMetrics({ schemaVersion: currentSchemaVersion, currentBlockHash: id, currentSlot: slot });
                return { id, slot };
            }
            else {
                return { id: currentBlockHash, slot: currentSlot };
            }
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
                    this.redisClientCall('del', [IndexNames.SLOT_HISTORY])
                    await this.redisClientCall('zadd', IndexNames.SLOT_HISTORY, history.map(([slot, hist]) => ({ score: slot, element: JSON.stringify(hist) })));
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

    // #region INDEXES *************************
    public getIndex(index: IndexNames, limit?: Limit, orderBy?: Sort): Map<string | number, ApiIndexType> {
        // SLOT & SLOT_HISTORY uses a an ordered set (ZSET)
        if (index.startsWith('slot')) {
            return this.redisClientCall('zrangeWithScores', index, { start: 0, end: -1 })
                .reduce((acc: Map<number, ISlotHistory>, value: { score: number, element: GlideString }) => {
                    acc.set(value.score, JSON.parse(value.element.toString()) as ISlotHistory);
                    return acc;
                }, new Map<number, ISlotHistory>());
        }
        const keys = this.redisClientCall('sort', index, {limit, orderBy: orderBy?.toUpperCase(), isAlpha: true} as SortOptions);
        const values: Map<string | number, ApiIndexType> = new Map<string | number, ApiIndexType>();
        for (const key of keys) {
            const value = this.getValueFromIndex(index, key);
            if (value)
                values.set(key, value);
        }
        return values;
    }

    public getKeysFromIndex(index: IndexNames, limit?: Limit, orderBy?: Sort): (string | number)[] {
        return [...this.redisClientCall('sort', index, {limit, orderBy: orderBy?.toUpperCase(), isAlpha: true} as SortOptions)]
            .map(v => !isNaN(Number(v.toString())) ? Number(v.toString()) : v.toString())
    }


    public getValueFromIndex(index: IndexNames, key: string | number): ApiIndexType | undefined {
        return this.rehydrateObjectFromCache(`${index}:${key}`);
    }

    public setValueOnIndex(index: IndexNames, key: string | number, value: ApiIndexType): void {
        // SLOT & SLOT_HISTORY uses a an ordered set (ZSET)
        if (index.startsWith('slot')) {
            this.redisClientCall('zadd', index, [{ element: typeof value == 'string' ? value : JSON.stringify(value), score: key as number }]);
            return;
        }
        this.saveObjectToCache(`${index}:${key}`, value)
        if (!INDEXES_IGNORE_ROOT.includes(index))
            this.redisClientCall('sadd', index, [key]);
    }

    public removeKeyFromIndex(index: IndexNames, key: string | number): void {
        // SLOT & SLOT_HISTORY uses a an ordered set (ZSET)
        if (index == IndexNames.SLOT) {
            this.redisClientCall('zrem', index, typeof key == 'string' ? key : JSON.stringify(key));
            return;
        }
        if (index == IndexNames.SLOT_HISTORY) {
            this.redisClientCall('zremRangeByScore', index, bound(key), bound(key));
            return;
        }
        this.redisClientCall('del', [`${index}:${key}`]);
        this.redisClientCall('srem', index, [key]);
    }

    // #endregion

    // #region SET INDEXES ************************
    public getValuesFromIndexedSet(index: IndexNames, key: string | number, limit?: Limit, orderBy?: Sort): Set<string> | undefined {
        return new Set([...this.redisClientCall('sort', `${index}:${key}`, {limit, orderBy: orderBy?.toUpperCase(), isAlpha: true} as SortOptions)].map(v => v.toString()))
    }

    public addValueToIndexedSet(index: IndexNames, key: string | number, value: string): void {
        this.redisClientCall('sadd', `${index}:${key}`, [value]);
        if (!INDEXES_IGNORE_ROOT.includes(index))
            this.redisClientCall('sadd', index, [key]);
    }

    public removeValueFromIndexedSet(index: IndexNames, key: string | number, value: string): void {
        if (key != null) {
            this.redisClientCall('srem', `${index}:${key}`, [value]);
            if ([...this.redisClientCall('smembers', `${index}:${key}`)].length == 0) {
                this.redisClientCall('srem', index, [key]);
            }
        }
    }

    // #endregion

    // #region METRICS *****************************
    public getMetrics(): IApiMetrics {
        const metrics = this.rehydrateObjectFromCache("metrics") || {} as IApiMetrics;
        metrics.count = this.count();
        return metrics;
    }

    public setMetrics(metrics: IApiMetrics): void {
        this.saveObjectToCache("metrics", { ...this.getMetrics(), ...metrics });
    }

    public count(): number {
        return this.redisClientCall('scard', IndexNames.HANDLE);
    }

    public getSchemaVersion(): number {
        return Number(process.env.STORAGE_SCHEMA_VERSION);
    }

    // #endregion

    // #region PRIVATE *******************************

    private async saveObjectToCache(key: string, obj: any) {
        const parentFields: Record<string, string> = {};
        for (const [field, value] of Object.entries(obj)) {
            if (value != undefined && value != null) {
                if (typeof value === "object") {
                    // JSON value → add to parent hash
                    parentFields[field] = JSON.stringify(value)
                } else {
                    // Primitive value → add to parent hash
                    parentFields[field] = String(value);
                }
            }
        }
        if (Object.keys(parentFields).length > 0) {
            const res = await this.redisClientCall('hset', key, parentFields);
        }
    }

    private rehydrateObjectFromCache(key: string): Record<string, any> | undefined {
        const result: Record<string, any> = {};
        const fields: HashDataType = this.redisClientCall('hgetall', key);
        if (fields.length == 0)
            return undefined
        for (const {field, value} of fields) {
            if (value.toString() == `${key}:${field}`)
                result[field.toString()] = this.rehydrateObjectFromCache(`${key}:${field}`)
            else {
                try { // This covers object, array, boolean, number
                    result[field.toString()] = JSON.parse(value.toString());
                }
                catch {
                    result[field.toString()] = value.toString();
                }
            }
        }
        return result;
    }

    private scanDescendentKeys(key: string, obj: any, keys: Set<string>) {
        keys.add(key);

        for (const [field, value] of Object.entries(obj)) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const childKey = `${key}:${field}`;
                this.scanDescendentKeys(childKey, value as Record<string, any>, keys);
            }
        }

    }

    private removeObjectAndDescendents(key: string, obj: any): void {
        const keys = new Set<string>();
        this.scanDescendentKeys(key, obj, keys);
        const ordered = [...keys].sort((a, b) => b.length - a.length);

        if (ordered.length > 0) {
            this.redisClientCall('del', ordered);
        }

    }

    private redisClientCall(cmd: string, ...args: any[]) {
        const id = RedisHandlesStore._id++;
        const sab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
        const view = new Int32Array(sab);

        RedisHandlesStore._worker.worker.postMessage({ id, sab, payload: { id, cmd, args } });

        // Block up to 30s so we don't hang forever
        const status = Atomics.wait(view, 0, 0, 30_000);
        if (status === 'timed-out') {
            throw new Error(`GlideClient ${cmd} timed out`);
        }

        const msg = receiveMessageOnPort(RedisHandlesStore._worker.port);
        if (!msg || msg.message.id !== id) {
            Logger.log({message: `GlideClient ${cmd} received no/incorrect reply: ${msg}`, category: LogCategory.ERROR, event: "redisClientCall.incorrectMessageResponse"});
            return undefined;
        }

        const { ok, result, error } = msg.message;
        if (!ok) {
            Logger.log({message: error?.message || `GlideClient ${cmd} failed`, category: LogCategory.ERROR, event: "redisClientCall.errorFromPostMessage"})
        }
        return result;
    }


    // #endregion
}