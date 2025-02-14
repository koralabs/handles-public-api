import { EMPTY, HandleSearchModel, Holder, HolderPaginationModel, HolderViewModel, HttpException, IApiMetrics, IHandleFileContent, IHandlesProvider, IndexNames, ISlotHistory, LogCategory, Logger, StoredHandle } from '@koralabs/kora-labs-common';
import fs from 'fs';
import { promisify } from 'util';
import { Worker } from 'worker_threads';
import { inflate } from 'zlib';
import { DISABLE_HANDLES_SNAPSHOT, isDatumEndpointEnabled, NETWORK, NODE_ENV } from '../../config';
import { memoryWatcher } from '../../services/ogmios/utils';
import { HandleStore } from './handleStore';

export class MemoryHandlesRepository implements IHandlesProvider {
    public setHandle(handleName: string, value: StoredHandle): void {
        HandleStore.handles.set(handleName, value);
    }

    public removeHandle(handleName: string): void {
        HandleStore.handles.delete(handleName)
    }

    public getIndex(indexName: IndexNames): any {
        return this.convertIndexNameToIndex(indexName);
    }

    public getValuesFromIndex(indexName: IndexNames, key: string | number): any {
        return this.convertIndexNameToIndex(indexName).get(key);
    }

    public setValueOnIndex(indexName: IndexNames, key: string | number, value: any): void {
        const index = this.convertIndexNameToIndex(indexName);
        const set = index.get(key);
        if (set instanceof Set) {
            set.add(value);
            index.set(key, set);
        }
        else {
            index.set(key, value)
        }
    }

    public removeValueFromIndex(indexName: IndexNames, key: string | number, value: string): void {
        const index = this.convertIndexNameToIndex(indexName).get(key);
        if (index instanceof Set) {
            index.delete(value);
        }
    }

    public removeKeyFromIndex(indexName: IndexNames, key: string | number): void {
        this.convertIndexNameToIndex(indexName).delete(key);

    }

    public getMetrics(): IApiMetrics {
        return this.metrics;
    }

    public getSchemaVersion(): number {
        return this._storageSchemaVersion;
    }

    private convertIndexNameToIndex(indexName: IndexNames) {
        let index: Map<string|number, any>;
        switch (indexName) {
            case IndexNames.ADDRESS:
                index = HandleStore.addressesIndex
                break;
            case IndexNames.CHARACTER:
                index = HandleStore.charactersIndex
                break;
            case IndexNames.HANDLE:
                index = HandleStore.handles
                break;
            case IndexNames.HASH_OF_STAKE_KEY_HASH:
                index = HandleStore.hashOfStakeKeyHashIndex
                break;
            case IndexNames.HOLDER:
                index = HandleStore.holderAddressIndex
                break;
            case IndexNames.LENGTH:
                index = HandleStore.lengthIndex
                break;
            case IndexNames.NUMERIC_MODIFIER:
                index = HandleStore.numericModifiersIndex
                break;
            case IndexNames.OG:
                index = HandleStore.ogIndex
                break;
            case IndexNames.PAYMENT_KEY_HASH:
                index = HandleStore.paymentKeyHashesIndex
                break;
            case IndexNames.RARITY:
                index = HandleStore.rarityIndex
                break;
            case IndexNames.SLOT_HISTORY:
                index = HandleStore.slotHistoryIndex
                break;
            case IndexNames.SUBHANDLE:
                index = HandleStore.subHandlesIndex
                break;
            case IndexNames.STAKE_KEY_HASH:
                index = HandleStore.addressesIndex
                break;
        }
        return index!;
    }

    private storageFolder = process.env.HANDLES_STORAGE || `${process.cwd()}/handles`;
    private _storageSchemaVersion = 40;
    private metrics: IApiMetrics = {
        firstSlot: 0,
        lastSlot: 0,
        currentSlot: 0,
        elapsedOgmiosExec: 0,
        elapsedBuildingExec: 0,
        firstMemoryUsage: 0,
        currentBlockHash: '',
        memorySize: 0
    };
    intervals: NodeJS.Timeout[] = [];

    private storageFileName = `handles.json`;
    private storageFilePath = `${this.storageFolder}/${NETWORK}/snapshot/${this.storageFileName}`;

    public initialize(): IHandlesProvider {
        if (this.intervals.length === 0) {
            const saveFilesInterval = setInterval(() => {
                const { currentSlot, currentBlockHash } = this.metrics;

                // currentSlot should never be zero. If it is, we don't want to write it and instead exit.
                // Once restarted, we should have a valid file to read from.
                if (currentSlot === 0) {
                    Logger.log({
                        message: 'Slot is zero. Exiting process.',
                        category: LogCategory.NOTIFY,
                        event: 'OgmiosService.saveFilesInterval'
                    });
                    process.exit(2);
                }

                this._saveHandlesFile(currentSlot ?? 0, currentBlockHash ?? '');

                memoryWatcher();
            }, 10 * 60 * 1000);

            const setMemoryInterval = setInterval(() => {
                const memorySize = this.memorySize();
                this.setMetrics({ memorySize });
            }, 60000);

            this.intervals = [saveFilesInterval, setMemoryInterval];
        }
        return this;
    }

    public destroy(): void {
        this.intervals.map((i) => clearInterval(i));
    }

    public getHandle(key: string): StoredHandle | null {
        const handle = HandleStore.handles.get(key);

        return this.returnHandleWithDefault(handle);
    }

    public getHandleByHex(hex: string): StoredHandle | null {
        let handle: StoredHandle | null = null;
        for (const [ , value] of HandleStore.handles.entries()) {
            if (value.hex === hex) handle = value;
            break;
        }
        return this.returnHandleWithDefault(handle);
    }

    private returnHandleWithDefault(handle?: StoredHandle | null) {
        if (!handle) {
            return null;
        }

        const holder = HandleStore.holderAddressIndex.get(handle.holder);
        if (holder) {
            handle.default_in_wallet = holder.defaultHandle;
        }

        return handle;
    }

    public count() {
        return HandleStore.handles.size;
    }

    public getAllHandles() {
        return Array.from(HandleStore.handles).map(([handle]) => this.getHandle(handle) as StoredHandle);
    }

    private _getRootHandleSubHandles (rootHandle: string) {
        return HandleStore.subHandlesIndex.get(rootHandle) ?? new Set();
    }
    
    private _saveHandlesFile(slot: number, hash: string, storagePath?: string, testDelay?: boolean): boolean {
        const handles = {
            ...this.convertMapsToObjects(HandleStore.handles)
        };
        const history = Array.from(HandleStore.slotHistoryIndex);
        storagePath = storagePath ?? this.storageFilePath;
        Logger.log(`Saving file with ${HandleStore.handles.size} handles & ${history.length} history entries`);
        const result = this.saveFileContents({
            content: { handles, history },
            storagePath,
            slot,
            hash,
            testDelay
        });
        return result;
    }
    
    private search(searchModel: HandleSearchModel) {
        const { characters, length, rarity, numeric_modifiers, search, holder_address, og, handle_type, handles } = searchModel;

        // helper function to get a list of hashes from the Set indexes
        const getHandlesFromIndex = (index: Map<string, Set<string>>, key: string | undefined) => {
            if (!key) return [];
            const array = Array.from(index.get(key) ?? [], (value) => value);
            return array.length === 0 ? [EMPTY] : array;
        };

        // get handle name arrays for all the search parameters
        const characterArray = getHandlesFromIndex(HandleStore.charactersIndex, characters);
        let lengthArray: string[] = [];
        if (length?.includes('-')) {
            for (let i = parseInt(length.split('-')[0]); i <= parseInt(length.split('-')[1]); i++) {
                lengthArray = lengthArray.concat(getHandlesFromIndex(HandleStore.lengthIndex, `${i}`));
            }
        } else {
            lengthArray = getHandlesFromIndex(HandleStore.lengthIndex, length);
        }
        const rarityArray = getHandlesFromIndex(HandleStore.rarityIndex, rarity);
        const numericModifiersArray = getHandlesFromIndex(HandleStore.numericModifiersIndex, numeric_modifiers);
        const ogArray = og ? getHandlesFromIndex(HandleStore.ogIndex, '1') : [];

        const getHolderAddressHandles = (key: string | undefined) => {
            if (!key) return [];
            const array = Array.from(HandleStore.holderAddressIndex.get(key)?.handles ?? [], (value) => value);
            return array.length === 0 ? [EMPTY] : array;
        };

        const holderAddressItemsArray = getHolderAddressHandles(holder_address);

        // filter out any empty arrays
        const filteredArrays = [characterArray, lengthArray, rarityArray, numericModifiersArray, holderAddressItemsArray, ogArray].filter((a) => a.length);

        // get the intersection of all the arrays
        const handleNames = filteredArrays.length ? filteredArrays.reduce((a, b) => a.filter((c) => b.includes(c))) : [];

        // remove duplicates by getting the unique names
        const uniqueHandleNames = [...new Set(handleNames)];

        // remove the empty names
        const nonEmptyHandles = uniqueHandleNames.filter((name) => name !== EMPTY);

        let array =
            characters || length || rarity || numeric_modifiers || holder_address || og
                ? nonEmptyHandles.reduce<StoredHandle[]>((agg, name) => {
                    const handle = this.getHandle(name as string);
                    if (handle) {
                        if (search && !handle.name.includes(search)) return agg;
                        if (handle_type && handle.handle_type !== handle_type) return agg;
                        if (handles && !handles.includes(handle.name)) return agg;
                        agg.push(handle);
                    }
                    return agg;
                }, [])
                : this.getAllHandles().reduce<StoredHandle[]>((agg, handle) => {
                    if (search && !(handle.name.includes(search) || handle.hex.includes(search))) return agg;
                    if (handle_type && handle.handle_type !== handle_type) return agg;
                    if (handles && !handles.includes(handle.name)) return agg;

                    agg.push(handle);
                    return agg;
                }, []);

        if (searchModel.personalized) {
            array = array.filter((handle) => handle.image_hash != handle.standard_image_hash);
        }
        return array;
    }

    public getAllHolders({ pagination }: { pagination: HolderPaginationModel }): Holder[] {
        const { page, sort, recordsPerPage } = pagination;

        const items: Holder[] = [...HandleStore.holderAddressIndex.values()].sort((a, b) => (sort === 'desc' ? b.handles.size - a.handles.size : a.handles.size - b.handles.size));
        const startIndex = (page - 1) * recordsPerPage;
        const holders = items.slice(startIndex, startIndex + recordsPerPage);

        return holders;
    }

    public getHolderAddressDetails(key: string): HolderViewModel {
        const holderAddressDetails = HandleStore.holderAddressIndex.get(key);
        if (!holderAddressDetails) throw new HttpException(404, 'Not found');

        const { defaultHandle, manuallySet, handles, knownOwnerName, type } = holderAddressDetails;

        return {
            total_handles: handles.size,
            default_handle: defaultHandle,
            manually_set: manuallySet,
            address: key,
            known_owner_name: knownOwnerName,
            type
        };
    }

    public getTotalHandlesStats(): { total_handles: number; total_holders: number } {
        return {
            total_handles: this.count(),
            total_holders: HandleStore.holderAddressIndex.size
        };
    }

    private convertMapsToObjects<T>(mapInstance: Map<string, T>) {
        return Array.from(mapInstance).reduce<Record<string, T>>((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
    }

    public memorySize() {
        const object = {
            ...this.convertMapsToObjects(HandleStore.handles),
            ...this.convertMapsToObjects(HandleStore.rarityIndex),
            ...this.convertMapsToObjects(HandleStore.ogIndex),
            ...this.convertMapsToObjects(HandleStore.subHandlesIndex),
            ...this.convertMapsToObjects(HandleStore.lengthIndex),
            ...this.convertMapsToObjects(HandleStore.charactersIndex),
            ...this.convertMapsToObjects(HandleStore.paymentKeyHashesIndex),
            ...this.convertMapsToObjects(HandleStore.numericModifiersIndex),
            ...this.convertMapsToObjects(HandleStore.addressesIndex)
        };

        return Buffer.byteLength(JSON.stringify(object));
    }

    public setMetrics(metrics: IApiMetrics): void {
        this.metrics = { ...this.metrics, ...metrics };
    }

    public rollBackToGenesis() {
        Logger.log({
            message: 'Rolling back to genesis',
            category: LogCategory.INFO,
            event: 'this.rollBackToGenesis'
        });

        // erase all indexes
        this.eraseStorage();

        // clear storage files
        this.saveFileContents({ storagePath: this.storageFilePath });
    }

    private saveFileContents({ content, storagePath, slot, hash, testDelay }: { storagePath: string; content?: any; slot?: number; hash?: string; testDelay?: boolean }): boolean {
        try {
            const worker = new Worker('./workers/this.worker.js', {
                workerData: {
                    content,
                    storagePath,
                    slot,
                    hash,
                    testDelay,
                    storageSchemaVersion: this._storageSchemaVersion
                }
            });
            worker.on('message', (data) => {
                return data;
            });
            worker.on('error', (msg) => {
                Logger.log({
                    message: `Error calling lockfile worker for handleStore: ${msg}`,
                    event: 'saveFileContents.errorSavingHandleStoreFile',
                    category: LogCategory.INFO
                });
            });
        } catch (error: any) {
            Logger.log({
                message: `Error calling lockfile worker for handleStore: ${error.message}`,
                event: 'saveFileContents.errorSavingHandleStoreFile',
                category: LogCategory.INFO
            });
            return false;
        }
        return true;
    }

    private checkIfExists(storagePath: string): boolean {
        try {
            const exists = fs.statSync(storagePath);
            if (exists) {
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }

    private async _getFile<T>(storagePath: string): Promise<T | null> {
        const thePath = NODE_ENV === 'local' ? 'storage/local.json' : storagePath;

        try {
            const exists = this.checkIfExists(thePath);
            if (!exists) {
                Logger.log({
                    message: `${thePath} file does not exist`,
                    category: LogCategory.INFO,
                    event: 'this.getFile.doesNotExist'
                });
                return null;
            }

            const file = fs.readFileSync(thePath, { encoding: 'utf8' });
            Logger.log({
                message: `${thePath} found`,
                category: LogCategory.INFO,
                event: 'this.getFile.fileFound'
            });

            return JSON.parse(file) as T;
        } catch (error: any) {
            Logger.log(`Error getting file from ${thePath} with error: ${error.message}`);
            return null;
        }
    }

    private async getFileOnline<T>(fileName: string): Promise<T | null> {
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
                return JSON.parse(text) as T;
            }

            Logger.log(`Unable to find ${url} online`);
            return null;
        } catch (error: any) {
            Logger.log(`Error fetching file from online with error: ${error.message}`);
            return null;
        }
    }

    private async prepareHandlesStorage(loadS3 = true): Promise<{ slot: number; hash: string; } | null> {
        const fileName = isDatumEndpointEnabled() ? 'handles.gz' : 'handles-no-datum.gz';
        const files = [this._getFile<IHandleFileContent>(this.storageFilePath)];
        if (loadS3) {
            files.push(this.getFileOnline<IHandleFileContent>(fileName));
        }
        const [localHandles, externalHandles] = await Promise.all(files);

        const localContent = localHandles && (localHandles?.schemaVersion ?? 0) == this._storageSchemaVersion ? localHandles : null;
        const externalContent = externalHandles && (externalHandles?.schemaVersion ?? 0) == this._storageSchemaVersion ? externalHandles : null;

        // If we don't have any valid files, return null
        if (!externalContent && !localContent) {
            Logger.log({
                message: 'No valid files found',
                category: LogCategory.INFO,
                event: 'this.prepareHandlesStorage.noValidFilesFound'
            });
            return null;
        }

        const buildFilesContent = (content: IHandleFileContent, isNew = false) => {
            return {
                handles: content.handles,
                history: content.history,
                slot: content.slot,
                schemaVersion: content.schemaVersion ?? 0,
                hash: content.hash,
                isNew
            };
        };

        let filesContent: {
            handles: Record<string, StoredHandle>;
            history: [number, ISlotHistory][];
            slot: number;
            schemaVersion: number;
            hash: string;
            isNew: boolean;
        } | null = null;

        // only the local file exists
        if (localContent && !externalContent) {
            filesContent = buildFilesContent(localContent);
        }

        // only the external file exists
        if (externalContent && !localContent) {
            filesContent = buildFilesContent(externalContent, true);
        }

        // both files exist and we need to compare them to see which one to use.
        if (externalContent && localContent) {
            // check to see if the local file slot is greater than the external file
            // if so, use the local file otherwise use the external file
            if (localContent.slot > externalContent.slot) {
                filesContent = buildFilesContent(localContent);
            } else {
                filesContent = buildFilesContent(externalContent, true);
            }
        }

        // At this point, we should have a valid filesContent object.
        // If we don't perform this check we'd have to use a large ternary operator which is pretty ugly
        if (!filesContent) {
            return null;
        }

        const { handles, slot, hash, history, isNew } = filesContent;

        // save all the individual handles to the store
        const keys = Object.keys(handles ?? {});
        for (let i = 0; i < keys.length; i++) {
            const name = keys[i];
            const handle = handles[name];
            const newHandle = {
                ...handle
            };
            // delete the personalization object from the handle so we don't double store it
            await this.save({ handle: newHandle, saveHistory: false });
        }

        // save the slot history to the store
        HandleStore.slotHistoryIndex = new Map(history);

        Logger.log(`Handle storage found at slot: ${slot} and hash: ${hash} with ${Object.keys(handles ?? {}).length} handles and ${history?.length} history entries`);

        // if the file contents are new (from the external source), save the handles and history to the store.
        if (isNew) {
            await this._saveHandlesFile(slot, hash);
        }

        return { slot, hash };
    }

    private eraseStorage() {
        // erase all indexes
        HandleStore.handles = new Map<string, StoredHandle>();
        HandleStore.holderAddressIndex = new Map<string, Holder>();
        HandleStore.rarityIndex = new Map<string, Set<string>>();
        HandleStore.ogIndex = new Map<string, Set<string>>();
        HandleStore.subHandlesIndex = new Map<string, Set<string>>();
        HandleStore.charactersIndex = new Map<string, Set<string>>();
        HandleStore.paymentKeyHashesIndex = new Map<string, Set<string>>();
        HandleStore.addressesIndex = new Map<string, Set<string>>();
        HandleStore.numericModifiersIndex = new Map<string, Set<string>>();
        HandleStore.lengthIndex = new Map<string, Set<string>>();
    }

    // Used for unit testing
    Internal = {
        saveHandlesFile: this._saveHandlesFile.bind(this),
        getFile: this._getFile.bind(this),
        getRootHandleSubHandles: this._getRootHandleSubHandles.bind(this),
        storageSchemaVersion: this._storageSchemaVersion
    }
}
