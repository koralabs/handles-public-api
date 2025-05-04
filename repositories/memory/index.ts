import { asyncForEach, Holder, HolderPaginationModel, HolderViewModel, HttpException, IApiMetrics, IHandleFileContent, IHandlesProvider, IndexNames, ISlotHistory, LogCategory, Logger, StoredHandle } from '@koralabs/kora-labs-common';
import fs from 'fs';
import { promisify } from 'util';
import { Worker } from 'worker_threads';
import { inflate } from 'zlib';
import { DISABLE_HANDLES_SNAPSHOT, isDatumEndpointEnabled, NETWORK, NODE_ENV } from '../../config';
import { memoryWatcher } from '../../services/ogmios/utils';
import { RewoundHandle } from '../handlesRepository';
import { HandleStore } from './handleStore';

export class MemoryHandlesProvider implements IHandlesProvider {
    private storageFolder = process.env.HANDLES_STORAGE || `${process.cwd()}/handles`;
    private _storageSchemaVersion = 43;
    intervals: NodeJS.Timeout[] = [];

    private storageFileName = `handles.json`;
    private storageFilePath = `${this.storageFolder}/${NETWORK}/snapshot/${this.storageFileName}`;
    private static metrics: IApiMetrics = {
        firstSlot: 0,
        lastSlot: 0,
        currentSlot: 0,
        elapsedOgmiosExec: 0,
        elapsedBuildingExec: 0,
        firstMemoryUsage: 0,
        currentBlockHash: '',
        memorySize: 0
    };

    public getValueFromIndex (indexName: IndexNames, key: string | number): Set<string> | Holder | ISlotHistory | StoredHandle | undefined {
        return this.convertIndexNameToIndex(indexName)?.get(key);
    }

    public setValueOnIndex (indexName: IndexNames, key: string | number, value: Set<string> | Holder | ISlotHistory | StoredHandle) {
        this.convertIndexNameToIndex(indexName)?.set(key, value);
    }

    private _files: IHandleFileContent[] | null = null;
    public setHandle(handleName: string, value: StoredHandle): void {
        HandleStore.handles.set(handleName, value);
    }

    public removeHandle(handleName: string): void {
        HandleStore.handles.delete(handleName)
    }

    public getIndex(indexName: IndexNames) {
        return this.convertIndexNameToIndex(indexName)!;
    }

    public getValuesFromIndexedSet(indexName: IndexNames, key: string | number): Set<string> | undefined {
        return (this.convertIndexNameToIndex(indexName) as Map<string|number, Set<string>>)?.get(key);
    }

    public addValueToIndexedSet(indexName: IndexNames, key: string | number, value: any): void {
        const index = this.convertIndexNameToIndex(indexName) as Map<string|number, Set<string>>;
        const set = index!.get(key) ?? new Set<string>();
        set.add(value);
        index!.set(key, set);
    }

    public removeValueFromIndexedSet(indexName: IndexNames, key: string | number, value: string): void {
        const index = this.convertIndexNameToIndex(indexName)?.get(key);
        if (index instanceof Set) {
            index.delete(value);
        }
    }

    public removeKeyFromIndex(indexName: IndexNames, key: string | number): void {
        this.convertIndexNameToIndex(indexName)?.delete(key);

    }

    public getMetrics(): IApiMetrics {
        MemoryHandlesProvider.metrics.count = HandleStore.handles.size;
        return MemoryHandlesProvider.metrics;
    }

    public getSchemaVersion(): number {
        return this._storageSchemaVersion;
    }

    private convertIndexNameToIndex(indexName: IndexNames): Map<string|number, Set<string> | Holder | ISlotHistory | StoredHandle> {
        switch (indexName) {
            case IndexNames.ADDRESS:
                return HandleStore.addressesIndex
            case IndexNames.CHARACTER:
                return HandleStore.charactersIndex
            case IndexNames.HASH_OF_STAKE_KEY_HASH:
                return HandleStore.hashOfStakeKeyHashIndex
            case IndexNames.LENGTH:
                return HandleStore.lengthIndex
            case IndexNames.NUMERIC_MODIFIER:
                return HandleStore.numericModifiersIndex
            case IndexNames.OG:
                return HandleStore.ogIndex
            case IndexNames.PAYMENT_KEY_HASH:
                return HandleStore.paymentKeyHashesIndex
            case IndexNames.RARITY:
                return HandleStore.rarityIndex
            case IndexNames.SUBHANDLE:
                return HandleStore.subHandlesIndex
            case IndexNames.HANDLE:
                return HandleStore.handles
            case IndexNames.HOLDER:
                return HandleStore.holderIndex
            case IndexNames.SLOT_HISTORY:
                return HandleStore.slotHistoryIndex
        }
    }

    public async initialize(): Promise<IHandlesProvider> {
        if (this.intervals.length === 0) {
            const saveFilesInterval = setInterval(() => {
                const { currentSlot, currentBlockHash } = MemoryHandlesProvider.metrics;

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
        this._files = await this._getFilesContent();
        return this;
    }

    public destroy(): void {
        this.intervals.map((i) => clearInterval(i));
    }

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

    public getAllHolders({ pagination }: { pagination: HolderPaginationModel }): Holder[] {
        const { page, sort, recordsPerPage } = pagination;

        const items: Holder[] = [...HandleStore.holderIndex.values()].sort((a, b) => (sort === 'desc' ? b.handles.length - a.handles.length : a.handles.length - b.handles.length));
        const startIndex = (page - 1) * recordsPerPage;
        const holders = items.slice(startIndex, startIndex + recordsPerPage);

        return holders;
    }

    public getHolderAddressDetails(key: string): HolderViewModel {
        const holderAddressDetails = HandleStore.holderIndex.get(key);
        if (!holderAddressDetails) throw new HttpException(404, 'Not found');

        const { defaultHandle, manuallySet, handles, knownOwnerName, type } = holderAddressDetails;

        return {
            total_handles: handles.length,
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
            total_holders: HandleStore.holderIndex.size
        };
    }

    private convertMapsToObjects<T>(mapInstance: Map<string, T>) {
        return Array.from(mapInstance).reduce<Record<string, T>>((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
    }

    public memorySize() {
        const object = [
            HandleStore.handles,
            HandleStore.rarityIndex,
            HandleStore.ogIndex,
            HandleStore.subHandlesIndex,
            HandleStore.lengthIndex,
            HandleStore.charactersIndex,
            HandleStore.paymentKeyHashesIndex,
            HandleStore.numericModifiersIndex,
            HandleStore.addressesIndex
        ]
        return Buffer.byteLength(JSON.stringify(object));
    }

    public setMetrics(metrics: IApiMetrics): void {
        MemoryHandlesProvider.metrics = { ...MemoryHandlesProvider.metrics, ...metrics };
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
            const worker = new Worker('./workers/handleStore.worker.js', {
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

    private async _getFileOnline<T>(fileName: string): Promise<T | null> {
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
    
    private async _getFilesContent() {
        const fileName = isDatumEndpointEnabled() ? 'handles.gz' : 'handles-no-datum.gz';
        const [localHandles, externalHandles] = await Promise.all([
            this._getFile<IHandleFileContent>(this.storageFilePath), 
            this._getFileOnline<IHandleFileContent>(fileName)
        ]);

        const localContent = localHandles && (localHandles?.schemaVersion ?? 0) == this._storageSchemaVersion ? localHandles : null;
        const externalContent = externalHandles && (externalHandles?.schemaVersion ?? 0) == this._storageSchemaVersion ? externalHandles : null;

        // If we don't have any valid files, return null
        if (!externalContent && !localContent) {
            Logger.log({
                message: 'No valid files found',
                category: LogCategory.INFO,
                event: 'HandleStore.prepareHandlesStorage.noValidFilesFound'
            });
            return null;
        }

        const buildFilesContent = (content: IHandleFileContent) => {
            return {
                handles: content.handles,
                history: content.history,
                slot: content.slot,
                schemaVersion: content.schemaVersion ?? 0,
                hash: content.hash
            };
        };

        // only the local file exists
        if (localContent && !externalContent) {
            return [buildFilesContent(localContent)];
        }

        // only the external file exists
        if (externalContent && !localContent) {
            return [buildFilesContent(externalContent)];
        }

        // both files exist and we need to compare them to see which one to use.

        if (externalContent && localContent) {
            const externalFilesContent = buildFilesContent(externalContent);
            const localFilesContent = buildFilesContent(localContent);
            // check to see if the local file slot is greater than the external file
            // if so, use the local file otherwise use the external file
            if (localContent.slot > externalContent.slot) {
                return [localFilesContent, externalFilesContent]
            } else {
                return [externalFilesContent, localFilesContent]
            }
        }

        // At this point, we should have a valid filesContent object.
        // If we don't perform this check we'd have to use a large ternary operator which is pretty ugly
        return null;
    }

    public async getStartingPoint(save: (handle: StoredHandle) => Promise<void>, failed = false) {
        if (!this._files || this._files.length === 0) {
            return null;
        }

        if (!failed) {
            const [firstFile] = this._files;
            await this.prepareHandlesStorage(save, firstFile);
            return { slot: firstFile.slot, id: firstFile.hash }
        }
        else {
            if (this._files.length > 1) {
                const [secondFile] = this._files.slice(1);
                await this.prepareHandlesStorage(save, secondFile);
                return { slot: secondFile.slot, id: secondFile.hash }
            }
        }
        this.rollBackToGenesis();
        return null;
    }

    private async prepareHandlesStorage(save: (handle: StoredHandle) => Promise<void>, filesContent: IHandleFileContent): Promise<void> {
        const startTime = Date.now()
        Logger.log('Preparing handles storage. Parsing file content...');
        const { handles, slot, hash, history } = filesContent;

        // save all the individual handles to the store
        await asyncForEach(Object.entries(handles), ([, handle]) => {
            return save(new RewoundHandle(handle));
        }, 1)

        // save the slot history to the store
        HandleStore.slotHistoryIndex = new Map(history);

        Logger.log(`Handle storage context parsed in ${(Date.now() - startTime)/1000}s at slot: ${slot} and hash: ${hash} with ${Object.keys(handles ?? {}).length} handles and ${history?.length} history entries`);
    }

    private eraseStorage() {
        // erase all indexes
        HandleStore.handles = new Map<string, StoredHandle>();
        HandleStore.holderIndex = new Map<string, Holder>();
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
        storageSchemaVersion: this._storageSchemaVersion,
        getFileOnline: this._getFileOnline.bind(this),
        getFilesContent: this._getFilesContent.bind(this)
    }
}
