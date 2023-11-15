import { IHandleStats } from '@koralabs/handles-public-api-interfaces';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import fetch from 'cross-fetch';
import { inflate } from 'zlib';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import { diff } from 'deep-object-diff';
import { isDatumEndpointEnabled, NETWORK, NODE_ENV, DISABLE_HANDLES_SNAPSHOT } from '../../../config';
import { buildCharacters, buildNumericModifiers, getRarity } from '../../../services/ogmios/utils';
import { getDefaultHandle } from '../../../utils/getDefaultHandle';
import { AddressDetails, getAddressHolderDetails } from '../../../utils/addresses';
import { getDateStringFromSlot, getElapsedTime } from '../../../utils/util';
import {
    IHandleFileContent,
    IHandleStoreMetrics,
    SaveMintingTxInput,
    SavePersonalizationInput,
    SaveWalletAddressMoveInput,
    HolderAddressIndex,
    ISlotHistoryIndex,
    HandleHistory,
    Handle
} from '../interfaces/handleStore.interfaces';

export class HandleStore {
    // Indexes
    private static handles = new Map<string, Handle>();
    static slotHistoryIndex = new Map<number, ISlotHistoryIndex>();
    static holderAddressIndex = new Map<string, HolderAddressIndex>();
    static rarityIndex = new Map<string, Set<string>>();
    static ogIndex = new Map<string, Set<string>>();
    static charactersIndex = new Map<string, Set<string>>();
    static numericModifiersIndex = new Map<string, Set<string>>();
    static lengthIndex = new Map<string, Set<string>>();

    static twelveHourSlot = 43200; // value comes from the securityParam here: https://cips.cardano.org/cips/cip9/#nonupdatableparameters then converted to slots
    static storageFolder = process.env.HANDLES_STORAGE || `${process.cwd()}/handles`;
    static storageSchemaVersion = 28;
    static metrics: IHandleStoreMetrics = {
        firstSlot: 0,
        lastSlot: 0,
        currentSlot: 0,
        elapsedOgmiosExec: 0,
        elapsedBuildingExec: 0,
        firstMemoryUsage: 0,
        currentBlockHash: '',
        memorySize: 0
    };

    static storageFileName = `handles.json`;
    static storageFilePath = `${HandleStore.storageFolder}/${NETWORK}/snapshot/${HandleStore.storageFileName}`;

    static get(key: string): Handle | null {
        const handle = HandleStore.handles.get(key);

        return this.returnHandleWithDefault(handle);
    }

    static getByHex(hex: string): Handle | null {
        let handle: Handle | null = null;
        for (let [key, value] of HandleStore.handles.entries()) {
          if (value.hex === hex)
            handle = value;
            break;
        }
        return this.returnHandleWithDefault(handle);
    }

    static returnHandleWithDefault(handle?: Handle | null) {
        if (!handle) {
            return null;
        }

        const holder = HandleStore.holderAddressIndex.get(handle.holder);
        if (holder) {
            handle.default_in_wallet = holder.defaultHandle;
        }
        
        return handle;
    }

    static count = () => {
        return this.handles.size;
    };

    static getHandles = () => {
        const handles = Array.from(HandleStore.handles, ([_, value]) => ({ ...value } as Handle));
        return handles.map((handle) => {
            const existingHandle = HandleStore.get(handle.name) as Handle;
            return existingHandle;
        });
    };

    static addIndexSet = (indexSet: Map<string, Set<string>>, indexKey: string, handleName: string) => {
        const set = indexSet.get(indexKey) ?? new Set();
        set.add(handleName);
        indexSet.set(indexKey, set);
    };

    static save = async ({
        handle,
        oldHandle,
        saveHistory = true
    }: {
        handle: Handle;
        oldHandle?: Handle;
        saveHistory?: boolean;
    }) => {
        const updatedHandle: Handle = JSON.parse(
            JSON.stringify(handle, (k, v) => (typeof v === 'bigint' ? parseInt(v.toString() || '0') : v))
        );
        const {
            name,
            rarity,
            og_number,
            characters,
            numeric_modifiers,
            length,
            resolved_addresses: { ada },
            updated_slot_number
        } = updatedHandle;

        const holder = getAddressHolderDetails(ada);
        updatedHandle.holder = holder.address;
        updatedHandle.holder_type = holder.type;

        const handleDefault = handle.default;
        delete handle.default // This is a temp property not meant to save to the handle

        // Set the main index
        this.handles.set(name, updatedHandle);

        // Set default name during personalization
        this.setHolderAddressIndex(holder, name, handleDefault, oldHandle?.holder);

        // set all one-to-many indexes
        this.addIndexSet(this.rarityIndex, rarity, name);

        const ogFlag = og_number === 0 ? 0 : 1;
        this.addIndexSet(this.ogIndex, `${ogFlag}`, name);
        this.addIndexSet(this.charactersIndex, characters, name);
        this.addIndexSet(this.numericModifiersIndex, numeric_modifiers, name);
        this.addIndexSet(this.lengthIndex, `${length}`, name);

        const isWithinMaxSlot = true;
        this.metrics.lastSlot &&
            this.metrics.currentSlot &&
            this.metrics.lastSlot - this.metrics.currentSlot < this.twelveHourSlot;
        if (saveHistory && isWithinMaxSlot) {
            const history = HandleStore.buildHandleHistory(updatedHandle, oldHandle);
            if (history)
                HandleStore.saveSlotHistory({
                    handleHistory: history,
                    handleName: name,
                    slotNumber: updated_slot_number
                });
        }
    };

    static remove = async (handleName: string) => {
        const handle = this.handles.get(handleName);
        if (!handle) {
            return;
        }

        const {
            rarity,
            holder,
            og_number,
            characters,
            numeric_modifiers,
            length,
            resolved_addresses: { ada }
        } = handle;

        // Set the main index
        this.handles.delete(handleName);

        const ogFlag = og_number === 0 ? 0 : 1;

        // set all one-to-many indexes
        this.rarityIndex.get(rarity)?.delete(handleName);
        this.ogIndex.get(`${ogFlag}`)?.delete(handleName);
        this.charactersIndex.get(characters)?.delete(handleName);
        this.numericModifiersIndex.get(numeric_modifiers)?.delete(handleName);
        this.lengthIndex.get(`${length}`)?.delete(handleName);

        // remove the stake key index
        this.holderAddressIndex.get(holder)?.handles.delete(handleName);
        this.setHolderAddressIndex(getAddressHolderDetails(ada));
    };

    static setHolderAddressIndex(
        holderAddressDetails: AddressDetails,
        handleName?: string,
        isDefault?: boolean,
        oldHolderAddress?: string
    ) {
        const { address: holderAddress, knownOwnerName, type } = holderAddressDetails;

        const holder = this.holderAddressIndex.get(holderAddress) ?? {
            handles: new Set(),
            defaultHandle: '',
            manuallySet: false,
            type,
            knownOwnerName
        };

        const getHandlesFromNames = (holder: HolderAddressIndex) => {
            const handles: Handle[] = [];
            holder.handles.forEach(h => {
                const handle = this.handles.get(h); 
                if (handle) 
                    handles.push(handle)
                else
                    holder.handles.delete(h)
            });
            return handles;
        }

        if (oldHolderAddress && handleName) {
            const oldHolder = this.holderAddressIndex.get(oldHolderAddress);
            if (oldHolder) {
                oldHolder.handles.delete(handleName);
                oldHolder.manuallySet = holder.manuallySet && (oldHolder.defaultHandle != handleName);
                oldHolder.defaultHandle =  oldHolder.manuallySet ? 
                    oldHolder.defaultHandle : getDefaultHandle(getHandlesFromNames(oldHolder))?.name ?? '';
            }
        }

        // add the new name if provided and does not already exist
        if (handleName && !holder.handles.has(handleName)) {
            holder.handles.add(handleName);
        }

        // if by this point, we have no handles, we need to remove the holder address from the index
        if (holder.handles.size === 0) {
            this.holderAddressIndex.delete(holderAddress);
            return;
        }
        // Set manuallySet to the incoming Handle if isDefault. If the incoming handleName is the same as the 
        // current holder default, then we might be turning it off (unsetting it as default)
        holder.manuallySet = !!isDefault || holder.manuallySet && (holder.defaultHandle != handleName);

        // get the default handle or use the defaultName provided (this is used during personalization)
        // Set defaultHandle to incoming if isDefault, otherwise if manuallySet, then keep the current
        // default. If neither, then run getDefaultHandle algo
        holder.defaultHandle = (!!isDefault && !!handleName) ? handleName : 
            holder.manuallySet ? holder.defaultHandle : getDefaultHandle(getHandlesFromNames(holder))?.name ?? '';

        this.holderAddressIndex.set(holderAddress, holder);
    }

    static buildHandle = ({
        hex,
        name,
        adaAddress,
        og_number,
        image,
        slotNumber,
        utxo,
        datum,
        script,
        amount = 1,
        bg_image = '',
        pfp_image = '',
        svg_version = '',
        version = 0,
        image_hash = '',
        personalization,
        reference_token
    }: SaveMintingTxInput): Handle => {
        const newHandle: Handle = {
            name,
            hex,
            holder: '', // Populate on save
            holder_type: '', // Populate on save
            length: name.length,
            utxo,
            rarity: getRarity(name),
            characters: buildCharacters(name),
            numeric_modifiers: buildNumericModifiers(name),
            resolved_addresses: {
                ada: adaAddress
            },
            og_number,
            standard_image: image,
            standard_image_hash: image_hash,
            image: image,
            image_hash: image_hash,
            bg_image,
            default_in_wallet: '',
            pfp_image,
            created_slot_number: slotNumber,
            updated_slot_number: slotNumber,
            has_datum: !!datum,
            datum: isDatumEndpointEnabled() && datum ? datum : undefined,
            script,
            personalization,
            reference_token,
            amount,
            svg_version,
            version
        };

        return newHandle;
    };

    static buildHandleHistory(newHandle: Partial<Handle>, oldHandle?: Partial<Handle>): HandleHistory | null {
        const { name } = newHandle;
        if (!oldHandle) {
            return NODE_ENV === 'production' ? { old: null } : { old: null, new: { name } };
        }

        // the diff will give us only properties that have been updated
        const difference = diff(oldHandle, newHandle);
        if (Object.keys(difference).length === 0) {
            return null;
        }

        // using the diff, we need to get the same properties from oldHandle
        const old = Object.keys(difference).reduce<Record<string, unknown>>((agg, key) => {
            agg[key] = oldHandle[key as keyof Handle];
            return agg;
        }, {});

        // Only save old details if the network is production.
        // Otherwise, save the new for testing purposes
        return NETWORK === 'production' ? { old } : { old, new: difference };
    }

    static saveSlotHistory({
        handleHistory,
        handleName,
        slotNumber,
        maxSlots = this.twelveHourSlot
    }: {
        handleHistory: HandleHistory;
        handleName: string;
        slotNumber: number;
        maxSlots?: number;
    }) {
        let slotHistory = HandleStore.slotHistoryIndex.get(slotNumber);
        if (!slotHistory) {
            slotHistory = {
                [handleName]: handleHistory
            };
        } else {
            slotHistory[handleName] = handleHistory;
        }

        const oldestSlot = slotNumber - maxSlots;
        HandleStore.slotHistoryIndex.forEach((_, slot) => {
            if (slot < oldestSlot) {
                HandleStore.slotHistoryIndex.delete(slot);
            }
        });

        HandleStore.slotHistoryIndex.set(slotNumber, slotHistory);
    }

    static saveMintedHandle = async (input: SaveMintingTxInput) => {
        const existingHandle = HandleStore.get(input.name);
        if (existingHandle) {
            // check if existing handle has a utxo. If it does, we may have a double mint
            if (!!existingHandle.utxo) {
                const updatedHandle = { ...existingHandle, amount: existingHandle.amount + 1 };
                await HandleStore.save({ handle: updatedHandle, oldHandle: existingHandle });
                return;
            }

            // if there is no utxo, it means we already received a 100 token.
            const inputWithExistingHandle: SaveMintingTxInput = {
                ...input,
                image: existingHandle.image,
                og_number: existingHandle.og_number,
                version: existingHandle.version,
                personalization: existingHandle.personalization
            };
            const builtHandle = HandleStore.buildHandle(inputWithExistingHandle);
            await HandleStore.save({ handle: builtHandle, oldHandle: existingHandle });
            return;
        }

        const newHandle = HandleStore.buildHandle(input);
        await HandleStore.save({ handle: newHandle });
    };

    static saveHandleUpdate = async ({
        name,
        adaAddress,
        utxo,
        slotNumber,
        datum,
        script
    }: SaveWalletAddressMoveInput) => {
        const existingHandle = HandleStore.get(name);
        if (!existingHandle) {
            Logger.log({
                message: `Handle was updated but there is no existing handle in storage with name: ${name}`,
                category: LogCategory.ERROR,
                event: 'saveHandleUpdate.noHandleFound'
            });
            return;
        }

        const updatedHandle = {
            ...existingHandle,
            utxo,
            resolved_addresses: { ada: adaAddress },
            updated_slot_number: slotNumber,
            has_datum: !!datum,
            datum: isDatumEndpointEnabled() && datum ? datum : undefined,
            script
        };

        await HandleStore.save({
            handle: updatedHandle,
            oldHandle: existingHandle
        });
    };

    static async savePersonalizationChange({
        name,
        hex,
        personalization,
        reference_token,
        personalizationDatum,
        addresses,
        slotNumber,
        metadata
    }: SavePersonalizationInput) {
        const image = metadata?.image ?? '';
        const version = metadata?.version ?? 0;
        const og_number = metadata?.og_number ?? 0;

        const existingHandle = HandleStore.get(name);
        if (!existingHandle) {
            const buildHandleInput: SaveMintingTxInput = {
                name,
                hex,
                slotNumber,
                adaAddress: '', // address will come from the 222 token
                utxo: '', // utxo will come from the 222 token,
                og_number,
                image,
                image_hash: personalizationDatum?.image_hash,
                personalization,
                reference_token,
                svg_version: personalizationDatum?.svg_version,
                version
            };
            const handle = HandleStore.buildHandle(buildHandleInput);
            await HandleStore.save({ handle });
            return;
        }

        // update resolved addresses
        // remove ada from the new addresses.
        if (addresses.ada) {
            delete addresses.ada;
        }

        const updatedHandle: Handle = {
            ...existingHandle,
            image,
            image_hash: personalizationDatum?.image_hash ?? '',
            standard_image_hash: personalizationDatum?.standard_image_hash ?? '',
            bg_image: personalizationDatum?.bg_image,
            bg_asset: personalizationDatum?.bg_asset,
            pfp_image: personalizationDatum?.pfp_image,
            pfp_asset: personalizationDatum?.pfp_asset,
            updated_slot_number: slotNumber,
            resolved_addresses: {
                ada: existingHandle.resolved_addresses.ada,
                ...addresses
            },
            personalization,
            reference_token,
            svg_version: personalizationDatum?.svg_version ?? '',
            default: (personalizationDatum?.default == 1) ?? false
        };

        await HandleStore.save({
            handle: updatedHandle,
            oldHandle: existingHandle
        });
    }

    static burnHandle = async (handleName: string, slotNumber: number) => {
        const existingHandle = HandleStore.get(handleName);
        if (!existingHandle) {
            Logger.log({
                message: `Cannot burn ${handleName} because Handle does not exist`,
                event: 'HandleStore.burnHandle',
                category: LogCategory.ERROR
            });

            return;
        }

        const burnAmount = existingHandle.amount - 1;

        if (burnAmount === 0) {
            await HandleStore.remove(handleName);
            const history: HandleHistory = { old: existingHandle, new: null };
            HandleStore.saveSlotHistory({
                handleHistory: history,
                handleName,
                slotNumber
            });
        } else {
            const updatedHandle = { ...existingHandle, amount: burnAmount };
            await HandleStore.save({ handle: updatedHandle, oldHandle: existingHandle });
        }
    };

    static convertMapsToObjects = <T>(mapInstance: Map<string, T>) => {
        return Array.from(mapInstance).reduce<Record<string, T>>((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
    };

    static memorySize() {
        const object = {
            ...this.convertMapsToObjects(this.handles),
            ...this.convertMapsToObjects(this.rarityIndex),
            ...this.convertMapsToObjects(this.ogIndex),
            ...this.convertMapsToObjects(this.lengthIndex),
            ...this.convertMapsToObjects(this.charactersIndex),
            ...this.convertMapsToObjects(this.numericModifiersIndex)
        };

        return Buffer.byteLength(JSON.stringify(object));
    }

    static setMetrics(metrics: IHandleStoreMetrics): void {
        this.metrics = { ...this.metrics, ...metrics };
    }

    static getTimeMetrics() {
        const { elapsedOgmiosExec = 0, elapsedBuildingExec = 0 } = this.metrics;
        return {
            elapsedOgmiosExec,
            elapsedBuildingExec
        };
    }

    static getMetrics(): IHandleStats {
        const {
            firstSlot = 0,
            lastSlot = 0,
            currentSlot = 0,
            firstMemoryUsage = 0,
            elapsedOgmiosExec = 0,
            elapsedBuildingExec = 0,
            currentBlockHash = '',
            memorySize = 0
        } = this.metrics;

        const handleSlotRange = lastSlot - firstSlot;
        const currentSlotInRange = currentSlot - firstSlot;

        const handleCount = this.count();

        const percentageComplete =
            currentSlot === 0 ? '0.00' : ((currentSlotInRange / handleSlotRange) * 100).toFixed(2);

        const currentMemoryUsage = process.memoryUsage().rss;
        const currentMemoryUsed = Math.round(((currentMemoryUsage - firstMemoryUsage) / 1024 / 1024) * 100) / 100;

        const ogmiosElapsed = getElapsedTime(elapsedOgmiosExec);
        const buildingElapsed = getElapsedTime(elapsedBuildingExec);

        const slotDate = getDateStringFromSlot(currentSlot);

        return {
            percentage_complete: percentageComplete,
            current_memory_used: currentMemoryUsed,
            ogmios_elapsed: ogmiosElapsed,
            building_elapsed: buildingElapsed,
            slot_date: slotDate,
            handle_count: handleCount,
            memory_size: memorySize,
            current_slot: currentSlot,
            current_block_hash: currentBlockHash,
            schema_version: HandleStore.storageSchemaVersion
        };
    }

    static isCaughtUp(): boolean {
        const { lastSlot = 0, currentSlot = 0, currentBlockHash = '0', tipBlockHash = '1' } = this.metrics;
        return lastSlot - currentSlot < 120 && currentBlockHash == tipBlockHash;
    }

    static async saveHandlesFile(
        slot: number,
        hash: string,
        storagePath?: string,
        testDelay?: boolean
    ): Promise<boolean> {
        const handles = {
            ...this.convertMapsToObjects(this.handles)
        };
        const history = Array.from(HandleStore.slotHistoryIndex);
        storagePath = storagePath ?? this.storageFilePath;
        Logger.log(`Saving file with ${this.handles.size} handles & ${history.length} history entries`);
        const result = await HandleStore.saveFileContents({
            content: { handles, history },
            storagePath,
            slot,
            hash,
            testDelay
        });
        return result;
    }

    static async saveFileContents({
        content,
        storagePath,
        slot,
        hash,
        testDelay
    }: {
        storagePath: string;
        content?: any;
        slot?: number;
        hash?: string;
        testDelay?: boolean;
    }): Promise<boolean> {
        try {
            const worker = new Worker(path.resolve(__dirname, '../../../workers/saveFile.worker.js'), {
                workerData: {
                    content,
                    storagePath,
                    slot,
                    hash,
                    testDelay,
                    storageSchemaVersion: this.storageSchemaVersion
                }
            });
            worker.on('message', (data) => {
                return data;
            });
            worker.on('error', (msg) => {
                Logger.log({
                    message: `Error calling lockfile worker: ${msg}`,
                    event: 'saveFileContents.errorSavingFile',
                    category: LogCategory.INFO
                });
            });
        } catch (error: any) {
            Logger.log({
                message: `Error calling lockfile worker: ${error.message}`,
                event: 'saveFileContents.errorSavingFile',
                category: LogCategory.INFO
            });
            return false;
        }
        return true;
    }

    static checkIfExists(storagePath: string): boolean {
        try {
            const exists = fs.statSync(storagePath);
            if (exists) {
                return true;
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    static async getFile<T>(storagePath: string): Promise<T | null> {
        const thePath = NODE_ENV === 'local' ? 'storage/local.json' : storagePath;

        try {
            const exists = this.checkIfExists(thePath);
            if (!exists) {
                Logger.log({
                    message: `${thePath} file does not exist`,
                    category: LogCategory.INFO,
                    event: 'HandleStore.getFile.doesNotExist'
                });
                return null;
            }

            const file = fs.readFileSync(thePath, { encoding: 'utf8' });
            Logger.log({
                message: `${thePath} found`,
                category: LogCategory.INFO,
                event: 'HandleStore.getFile.fileFound'
            });

            return JSON.parse(file) as T;
        } catch (error: any) {
            Logger.log(`Error getting file from ${thePath} with error: ${error.message}`);
            return null;
        }
    }

    static async getFileOnline<T>(fileName: string): Promise<T | null> {
        if (NODE_ENV === 'local' || DISABLE_HANDLES_SNAPSHOT == 'true') {
            return null;
        }

        try {
            const url = `http://api.handle.me.s3-website-us-west-2.amazonaws.com/${NETWORK}/snapshot/${this.storageSchemaVersion}/${fileName}`;
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

    static async prepareHandlesStorage(): Promise<{
        slot: number;
        hash: string;
    } | null> {
        const fileName = isDatumEndpointEnabled() ? 'handles.gz' : 'handles-no-datum.gz';
        const [externalHandles, localHandles] = await Promise.all([
            HandleStore.getFileOnline<IHandleFileContent>(fileName),
            HandleStore.getFile<IHandleFileContent>(this.storageFilePath)
        ]);

        const localContent =
            localHandles && (localHandles?.schemaVersion ?? 0) >= this.storageSchemaVersion ? localHandles : null;

        // If we don't have any valid files, return null
        if (!externalHandles && !localContent) {
            Logger.log({
                message: 'No valid files found',
                category: LogCategory.INFO,
                event: 'HandleStore.prepareHandlesStorage.noValidFilesFound'
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
            handles: Record<string, Handle>;
            history: [number, ISlotHistoryIndex][];
            slot: number;
            schemaVersion: number;
            hash: string;
            isNew: boolean;
        } | null = null;

        // only the local file exists
        if (localContent && !externalHandles) {
            filesContent = buildFilesContent(localContent);
        }

        // only the external file exists
        if (externalHandles && !localContent) {
            filesContent = buildFilesContent(externalHandles, true);
        }

        // both files exist and we need to compare them to see which one to use.
        if (externalHandles && localContent) {
            if (
                // check to see if the local file slot and schema version are greater than the external file
                // if so, use the local file otherwise use the external file
                localContent.slot > externalHandles.slot &&
                (localContent.schemaVersion ?? 0) >= (externalHandles.schemaVersion ?? 0)
            ) {
                filesContent = buildFilesContent(localContent);
            } else {
                filesContent = buildFilesContent(externalHandles, true);
            }
        }

        // At this point, we should have a valid filesContent object.
        // If we don't perform this check we'd have to use a large terinary operator which is pretty ugly
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
            await HandleStore.save({ handle: newHandle, saveHistory: false });
        }

        // save the slot history to the store
        HandleStore.slotHistoryIndex = new Map(history);

        Logger.log(
            `Handle storage found at slot: ${slot} and hash: ${hash} with ${
                Object.keys(handles ?? {}).length
            } handles and ${history?.length} history entries`
        );

        // if the file contents are new (from the external source), save the handles and history to the store.
        if (isNew) {
            await HandleStore.saveHandlesFile(slot, hash);
        }

        return { slot, hash };
    }

    static async rollBackToGenesis() {
        Logger.log({
            message: 'Rolling back to genesis',
            category: LogCategory.INFO,
            event: 'HandleStore.rollBackToGenesis'
        });

        // erase all indexes
        this.handles = new Map<string, Handle>();
        this.holderAddressIndex = new Map<string, HolderAddressIndex>();
        this.rarityIndex = new Map<string, Set<string>>();
        this.ogIndex = new Map<string, Set<string>>();
        this.charactersIndex = new Map<string, Set<string>>();
        this.numericModifiersIndex = new Map<string, Set<string>>();
        this.lengthIndex = new Map<string, Set<string>>();

        // clear storage files
        await HandleStore.saveFileContents({ storagePath: HandleStore.storageFilePath });
    }

    static async rewindChangesToSlot({
        slot,
        hash,
        lastSlot
    }: {
        slot: number;
        hash: string;
        lastSlot: number;
    }): Promise<{name:string, action: string, handle: Partial<Handle> | undefined}[]> {
        // first we need to order the historyIndex desc by slot
        const orderedHistoryIndex = [...this.slotHistoryIndex.entries()].sort((a, b) => b[0] - a[0]);
        let handleUpdates = 0;
        let handleDeletes = 0;
        let rewoundHandles = [];

        // iterate through history starting with the most recent up to the slot we want to rewind to.
        for (const item of orderedHistoryIndex) {
            const [slotKey, history] = item;

            // once we reach the slot we want to rewind to, we can stop
            if (slotKey <= slot) {
                Logger.log({
                    message: `Finished Rewinding to slot ${slot} with ${handleUpdates} updates and ${handleDeletes} deletes.`,
                    category: LogCategory.INFO,
                    event: 'HandleStore.rewindChangesToSlot'
                });

                // Set metrics to get the correct slot saving and percentage if there are no new blocks
                HandleStore.setMetrics({ currentSlot: slot, currentBlockHash: hash, lastSlot });
                break;
            }

            // iterate through each handle hex in the history and revert it to the previous state
            const keys = Object.keys(history);
            for (let i = 0; i < keys.length; i++) {
                const name = keys[i];
                const handleHistory = history[name];

                const existingHandle = this.get(name);
                if (!existingHandle) {
                    if (handleHistory.old) {
                        rewoundHandles.push({name, action: "create", handle: handleHistory.old});
                        await this.save({ handle: handleHistory.old as Handle, saveHistory: false });
                        handleUpdates++;
                        continue;
                    }

                    Logger.log(`Handle ${name} does not exist`);
                    continue;
                }

                if (handleHistory.old === null) {
                    // if the old value is null, then the handle was deleted
                    // so we need to remove it from the indexes
                    rewoundHandles.push({name, action: "delete", handle: undefined});
                    await this.remove(name);
                    handleDeletes++;
                    continue;
                }

                // otherwise we need to update the handle with the old values
                const updatedHandle: Handle = {
                    ...existingHandle,
                    ...handleHistory.old
                };

                rewoundHandles.push({name, action: "update", handle: updatedHandle});
                await this.save({ handle: updatedHandle, oldHandle: existingHandle, saveHistory: false });
                handleUpdates++;
            }

            // delete the slot key since we are rolling back to it
            this.slotHistoryIndex.delete(slotKey);
        }
        return rewoundHandles;
    }
}

// #// webhook processor tracks block hash processed, only sends out webhook calls if not already processed
// #// webhook processor tracks rollback hashes, only sends out webhook calls if not already processed
// create: saveMintedHandle
// update: saveHandleUpdate or savePersonalizationChange (latter for pz-only)
// #// (any,pz-only,address-only,utxo-only,holder-only)
// #// use this to get if address/utxo change: diff(oldHandle, newHandle)
// #// Can exclude UTxO changes
// #// Can filter by list of handles/holders (up to 10?)
// delete: burnHandle

// rewind: rewindChangesToSlot