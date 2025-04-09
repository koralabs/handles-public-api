import { Holder, IApiMetrics, IHandleFileContent, IHandlesProvider, IndexNames, ISlotHistory, LogCategory, Logger, NETWORK, StoredHandle } from '@koralabs/kora-labs-common';
import { GlideClient } from '@valkey/valkey-glide';
import { promisify } from 'util';
import { inflate } from 'zlib';
import { DISABLE_HANDLES_SNAPSHOT, NODE_ENV } from '../../config';
import { RewoundHandle } from '../handlesRepository';

export class RedisHandlesProvider implements IHandlesProvider {
    private static redis: GlideClient | undefined = undefined;

    /********* SETUP *************/
    public async initialize(): Promise<IHandlesProvider> {
        // initialize valkey/redis
        if (!RedisHandlesProvider.redis){
            RedisHandlesProvider.redis = await GlideClient.createClient({
                addresses: [{host: process.env.REDIS_HOST ?? 'localhost'}],
                // if the server uses TLS, you'll need to enable it. Otherwise, the connection attempt will time out silently.
                useTLS: process.env.REDIS_USE_TLS == 'true'
            });
        }
        return this;
    }

    public destroy(): void {
        RedisHandlesProvider.redis = undefined;
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
                    const keys = Object.keys(handles ?? {});
                    for (let i = 0; i < keys.length; i++) {
                        const name = keys[i];
                        const handle = handles[name];
                        const newHandle = {
                            ...handle
                        };
                        // delete the personalization object from the handle so we don't double store it
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
        const handle = structuredClone(HandleStore.handles.get(key));

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
        RedisHandlesProvider.redis?.hset(`${IndexNames.HANDLE}:${key}`, value)

    }

    public removeHandle(handleName: string): void {

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

}