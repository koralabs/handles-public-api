import { ApiIndexType, IApiMetrics, IApiStore, IHandleFileContent, IndexNames, ISlotHistory, isNumeric, LogCategory, Logger, NETWORK, SortAndLimitOptions, StoredHandle } from '@koralabs/kora-labs-common';
import { GlideString, HashDataType, SortOptions } from '@valkey/valkey-glide';
import { promisify } from 'util';
import { MessageChannel, receiveMessageOnPort, Worker } from 'worker_threads';
import { inflate } from 'zlib';
import { DISABLE_HANDLES_SNAPSHOT, isDatumEndpointEnabled, NODE_ENV } from '../../config';
import { handleEraBoundaries, META_INDEXES } from '../../config/constants';
import { RewoundHandle } from '../../repositories/handlesRepository';

// const glideClient = await GlideClient.createClient({
//       addresses: [{ host: 'https://localhost', port: 6379 }],
//       useTLS: process.env.REDIS_USE_TLS ? process.env.REDIS_USE_TLS == 'true' : true
// });

// glideClient.zremRangeByScore('', {value: 0, isInclusive: true})

const redisTimings: Record<string, number> = {};

export class RedisHandlesStore implements IApiStore {
    private static _worker: any;
    private static _id = 0;
    private static _pipeline: [string, any[]][] | undefined = undefined;

    // #region SETUP **************************
    public async initialize(): Promise<IApiStore> {
        if (!RedisHandlesStore._worker) {
            const worker = new Worker('./workers/redisSync.worker.js');
            worker.on('error', (e) => Logger.log({ message: `Error: ${e}`, category: LogCategory.ERROR, event: "ValkeySyncWorker.Error" }));
            worker.on('exit', (e) => Logger.log({ message: `Error: ${e}`, category: LogCategory.ERROR, event: "ValkeySyncWorker.Exit" }));
            RedisHandlesStore._worker = worker;
        }
        //const interval = setInterval(() => {console.log('TIMINGS', JSON.stringify(Object.entries(redisTimings).sort((a, b) => b[1] - a[1])))}, 10_000)
        return this;
    }
    /**
     * Be careful with the pipeline command.
     * Since the commands are queued and executed in a batch, 
     * you won't get results for each command until AFTER the pipeline finishes.
     * You'll have to iterate over the batch results that come back in the 
     * response of pipeline() to find your desired results.
     * If it feels like your code "isn't running" or "isn't returning anything", this is probably why.
     */
    public pipeline(commands: CallableFunction) {
        RedisHandlesStore._pipeline = []
        commands();
        //console.log('PIPELINE', RedisHandlesStore._pipeline)
        const results = this.redisClientCall('batch', RedisHandlesStore._pipeline);
        for (let i = 0; i < results.length; i++ ) {
            if (RedisHandlesStore._pipeline[i][0] == 'hgetall') {
                //console.log(RedisHandlesStore._pipeline[i][1][0], results[i])
                results[i] = this.rehydrateObject(RedisHandlesStore._pipeline[i][1][0], results[i])
            }
        }
        RedisHandlesStore._pipeline = undefined;
        return results;
    }

    public destroy(): void {
        this.redisClientCall('flushdb')
        this.redisClientCall('close')
        RedisHandlesStore._pipeline = undefined;
        if (RedisHandlesStore._worker.terminate)
            RedisHandlesStore._worker.terminate();
        RedisHandlesStore._worker = undefined;
    }

    public rollBackToGenesis(): void {
        Logger.log({ message: 'Calling FLUSHDB', category: LogCategory.INFO, event: 'this.rollBackToGenesis' });
        // Clear all redis cache
        this.redisClientCall('flushdb');
        RedisHandlesStore._pipeline = undefined;
    }

    public async getStartingPoint(save: (handle: StoredHandle) => void, failed = false): Promise<{ slot: number; id: string; } | null> {
        if (!failed) {
            const { schemaVersion, currentSlot, currentBlockHash } = this.getMetrics();
            const currentSchemaVersion = this.getSchemaVersion();
            if (currentSchemaVersion > (schemaVersion ?? 0) || !currentBlockHash || !currentSlot) {
                this.redisClientCall('flushdb');
                const { id, slot } = handleEraBoundaries[NETWORK];
                this.setMetrics({ schemaVersion: currentSchemaVersion, currentBlockHash: id, currentSlot: slot, startTimestamp: Date.now() });
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
                    this.redisClientCall('del', [`{root}:${IndexNames.SLOT_HISTORY}`])
                    await this.redisClientCall('zadd', `{root:}${IndexNames.SLOT_HISTORY}`, history.map(([slot, hist]) => ({ score: slot, element: JSON.stringify(hist) })));
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
    public getIndex(index: IndexNames, options?: SortAndLimitOptions): Map<string | number, ApiIndexType> {
        // SLOT & SLOT_HISTORY uses a an ordered set (ZSET)
        if (index == IndexNames.SLOT_HISTORY) {
            return this.parseSlotHistory(this.redisClientCall('zrangeWithScores', `{root}:${index}`, { start: 0, end: -1 }));
        }
        if (options?.isAlpha == undefined)
            options = {...options, isAlpha: true}
        const keys = this.redisClientCall('sort', `{root}:${index}`, options as SortOptions);
        const values: Map<string | number, ApiIndexType> = new Map<string | number, ApiIndexType>();
        for (const key of keys) {
            const value = this.getValueFromIndex(index, key);
            if (value)
                values.set(String(key), value);
        }
        return values;
    }

    public getKeysFromIndex(index: IndexNames, options?: SortAndLimitOptions): (string | number)[] {
        if (index.startsWith('slot')) {
            // SLOT & SLOT_HISTORY uses a an ordered set (ZSET)
            return [...this.redisClientCall(
                        'zrange', 
                        `{root}:${index}`, 
                        {...options, type: 'byScore', start: { value: options?.start }, end: { value: options?.end }} as SortOptions, 
                        {reverse: options?.orderBy?.toUpperCase() == 'DESC'}
                    )].map(v => isNumeric(v.toString()) ? Number(v.toString()) : v.toString());
        }
        return [...this.redisClientCall('sort', `{root}:${index}`, {...options, isAlpha: true} as SortOptions)]
            .map(v => isNumeric(v.toString()) && index != IndexNames.HANDLE ? Number(v.toString()) : v.toString())
    }

    public getValueFromIndex(index: IndexNames, key: string | number): ApiIndexType | undefined {
        if (index == IndexNames.SLOT_HISTORY) {
            const value = this.parseSlotHistory(this.redisClientCall('zrangeWithScores', `{root}:${index}`, {type: 'byScore', start: { value: key }, end: { value: key }}));
            return value.get(key as number)
        }
        return this.rehydrateObjectFromCache(`{root}:${index}:${key}`);
    }

    public setValueOnIndex(index: IndexNames, key: string | number, value: ApiIndexType): void {
        if (index.startsWith('slot')) {
            // SLOT & SLOT_HISTORY uses a an ordered set (ZSET)
            if (index == IndexNames.SLOT_HISTORY) {
                value = `${key}|${JSON.stringify(value)}`;
                this.redisClientCall('zremRangeByScore', `{root}:${index}`, { value: key, isInclusive: true }, { value: key, isInclusive: true });
            }
            this.redisClientCall('zadd', `{root}:${index}`, [{ element: value, score: key as number }]);
            return;
        }
        this.saveObjectToCache(`{root}:${index}:${key}`, value)
        if (META_INDEXES.includes(index))
            this.redisClientCall('sadd', `{root}:${index}`, [key]);
    }

    public removeKeyFromIndex(index: IndexNames, key: string | number): void {
        if (index == IndexNames.SLOT) {
            // SLOT & SLOT_HISTORY uses a an ordered set (ZSET)
            this.redisClientCall('zrem', `{root}:${index}`, typeof key == 'string' ? key : JSON.stringify(key));
            return;
        }
        if (index == IndexNames.SLOT_HISTORY) {
                this.redisClientCall('zremRangeByScore', `{root}:${index}`, "-", { value: key, isInclusive: false });
            return;
        }
        this.redisClientCall('del', [`{root}:${index}:${key}`]);
        this.redisClientCall('srem', `{root}:${index}`, [key]);
    }

    // #endregion

    // #region SET INDEXES ************************
    public getValuesFromIndexedSet(index: IndexNames, key: string | number, options?: SortAndLimitOptions): Set<string> | undefined {
        if (options?.isAlpha == undefined)
            options = {...options, isAlpha: true}
        return new Set([...this.redisClientCall('smembers', `{root}:${index}:${key}`, options as SortOptions)].map(v => v.toString()))
    }

    public addValueToIndexedSet(index: IndexNames, key: string | number, value: string): void {
        this.redisClientCall('sadd', `{root}:${index}:${key}`, [value]);
        if (META_INDEXES.includes(index))
            this.redisClientCall('sadd', `{root}:${index}`, [key]);
    }

    public removeValueFromIndexedSet(index: IndexNames, key: string | number, value: string): void {
        if (key != null) {
            this.redisClientCall('srem', `{root}:${index}:${key}`, [value]);
            if (META_INDEXES.includes(index)) {
                const count = this.redisClientCall('scard', `{root}:${index}:${key}`) as number;
                if ((RedisHandlesStore._pipeline && count == 1) || !count)
                    this.redisClientCall('srem', `{root}:${index}`, [key]);
            }
        }
    }

    // #endregion

    // #region METRICS *****************************
    public getMetrics(): IApiMetrics {
        const metrics = this.rehydrateObjectFromCache("metrics") || {} as IApiMetrics;
        metrics.handleCount = this.count();
        metrics.holderCount = this.holderCount();
        return metrics;
    }

    public setMetrics(metrics: Partial<IApiMetrics>): void {
        const formattedMetrics = Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, String(v)]));
        this.redisClientCall('hset', "metrics", formattedMetrics);
    }

    public count(): number {
        return this.redisClientCall('scard', `{root}:${IndexNames.HANDLE}`);
    }

    public holderCount(): number {
        return this.redisClientCall('scard', `{root}:${IndexNames.HOLDER}`);
    }

    public getSchemaVersion(): number {
        return Number(process.env.STORAGE_SCHEMA_VERSION);
    }

    // #endregion

    // #region PRIVATE *******************************

    private parseSlotHistory(results: { score: number, element: GlideString }[]) {
        return results.reduce((acc: Map<number, ISlotHistory>, value: { score: number, element: GlideString }) => {
            acc.set(value.score, JSON.parse(value.element.toString().split('|')[1]) as ISlotHistory);
            return acc;
        }, new Map<number, ISlotHistory>())
    }

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
            this.redisClientCall('hset', key, parentFields);
        }
    }

    private rehydrateObjectFromCache(key: string): Record<string, any> | undefined {
        const fields: HashDataType = this.redisClientCall('hgetall', key);
        return this.rehydrateObject(key, fields);
    }

    private rehydrateObject(key: string, fields: HashDataType): Record<string, any> | undefined {
        const result: Record<string, any> = {};
        if (!fields || fields.length == 0)
            return undefined
        //                                  very annoying workaround for the difference in normal and batch variants of `hgetall()`
        for (const {field: f, value} of fields.map((entry: any) => ({ field: entry.field ?? entry.key, value: entry.value }))) {
            const field = f.toString();
            if (value.toString() == `${key}:${field}`)
                result[field] = this.rehydrateObjectFromCache(`${key}:${field}`)
            else {
                try {
                    if (['name', 'hex', 'default_in_wallet'].includes(field))
                        result[field] = value.toString();
                    else
                        result[field] = JSON.parse(value.toString()); // This covers object, array, boolean, number
                    
                }
                catch {
                    result[field] = value.toString();
                }
            }
        }
        return result;
    }

    private redisClientCall(cmd: string, ...args: any[]) {
        if (RedisHandlesStore._pipeline && cmd != 'batch') {
            if (cmd != 'scard') { // scard needs to go through for removeValueFromIndexedSet to work right
                RedisHandlesStore._pipeline.push([cmd, args]);
                return;
            }
        }
        const start = Date.now()
        
        const id = RedisHandlesStore._id++;
        const sab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
        const view = new Int32Array(sab);

        const { port1, port2 } = new MessageChannel();
        RedisHandlesStore._worker.postMessage({ id, sab, payload: { id, cmd, args }, reply: port2 }, [port2]);

        // Block up to 30s so we don't hang forever
        const status = Atomics.wait(view, 0, 0, 30_000);
        if (status === 'timed-out') {
            throw new Error(`GlideClient ${cmd} timed out`);
        }

        const msg = receiveMessageOnPort(port1);
        port1.close()
        
        const end = Date.now();
        redisTimings[cmd] = (redisTimings[cmd] ?? 0) + (end - start);

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