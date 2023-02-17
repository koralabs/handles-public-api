import { IHandleStats, IPersonalization, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';
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
    HandleHistory
} from '../interfaces/handleStore.interfaces';
import { MetadatumAssetLabel } from '../../../interfaces/ogmios.interfaces';

export class HandleStore {
    // Indexes
    private static handles = new Map<string, IPersonalizedHandle>();
    static slotHistoryIndex = new Map<number, ISlotHistoryIndex>();
    static holderAddressIndex = new Map<string, HolderAddressIndex>();
    static orphanedPersonalizationIndex = new Map<string, IPersonalization>();
    static nameIndex = new Map<string, string>();
    static rarityIndex = new Map<string, Set<string>>();
    static ogIndex = new Map<string, Set<string>>();
    static charactersIndex = new Map<string, Set<string>>();
    static numericModifiersIndex = new Map<string, Set<string>>();
    static lengthIndex = new Map<string, Set<string>>();

    static twelveHourSlot = 43200; // value comes from the securityParam here: https://cips.cardano.org/cips/cip9/#nonupdatableparameters then converted to slots
    static storageFolder = process.env.HANDLES_STORAGE || `${process.cwd()}/handles`;
    static storageSchemaVersion = 8;
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

    static get = (key: string): IPersonalizedHandle | null => {
        const handle = HandleStore.handles.get(key);
        if (!handle) {
            return null;
        }

        const holderAddressIndex = HandleStore.holderAddressIndex.get(handle.holder_address);
        if (holderAddressIndex) {
            handle.default_in_wallet = holderAddressIndex.defaultHandle;
        }

        return handle;
    };

    static count = () => {
        return this.handles.size;
    };

    static getHandles = () => {
        const handles = Array.from(HandleStore.handles, ([_, value]) => ({ ...value } as IPersonalizedHandle));
        return handles.map((handle) => {
            const existingHandle = HandleStore.get(handle.hex) as IPersonalizedHandle;
            return existingHandle;
        });
    };

    static getFromNameIndex = (name: string) => {
        return this.nameIndex.get(name);
    };

    static addIndexSet = (indexSet: Map<string, Set<string>>, indexKey: string, hexName: string) => {
        const set = indexSet.get(indexKey) ?? new Set();
        set.add(hexName);
        indexSet.set(indexKey, set);
    };

    static save = async ({
        handle,
        oldHandle,
        saveHistory = true
    }: {
        handle: IPersonalizedHandle;
        oldHandle?: IPersonalizedHandle;
        saveHistory?: boolean;
    }) => {
        const updatedHandle: IPersonalizedHandle = JSON.parse(JSON.stringify(handle));
        const {
            name,
            rarity,
            og,
            characters,
            numeric_modifiers,
            length,
            hex,
            resolved_addresses: { ada },
            updated_slot_number
        } = updatedHandle;

        const holderAddressDetails = await getAddressHolderDetails(ada);
        updatedHandle.holder_address = holderAddressDetails.address;

        // Set the main index
        this.handles.set(hex, updatedHandle);

        // set all one-to-one indexes
        this.nameIndex.set(name, hex);

        // set all one-to-many indexes
        this.addIndexSet(this.rarityIndex, rarity, hex);
        this.addIndexSet(this.ogIndex, `${og}`, hex);
        this.addIndexSet(this.charactersIndex, characters, hex);
        this.addIndexSet(this.numericModifiersIndex, numeric_modifiers, hex);
        this.addIndexSet(this.lengthIndex, `${length}`, hex);

        // TODO: set default name during personalization
        this.setHolderAddressIndex(holderAddressDetails, hex);

        const isWithinMaxSlot = true;
        this.metrics.lastSlot &&
            this.metrics.currentSlot &&
            this.metrics.lastSlot - this.metrics.currentSlot < this.twelveHourSlot;
        if (saveHistory && isWithinMaxSlot) {
            const history = HandleStore.buildHandleHistory(updatedHandle, oldHandle);
            if (history) HandleStore.saveSlotHistory({ handleHistory: history, hex, slotNumber: updated_slot_number });
        }
    };

    static remove = async (hexName: string) => {
        Logger.log({ category: LogCategory.INFO, message: `Removing handle ${hexName}`, event: 'HandleStore.remove' });

        const handle = this.handles.get(hexName);
        if (!handle) {
            Logger.log({
                message: `Handle ${hexName} not found`,
                event: 'HandleStore.remove',
                category: LogCategory.WARN
            });
            return;
        }

        const { name, rarity, holder_address, og, characters, numeric_modifiers, length, hex } = handle;

        // Set the main index
        this.handles.delete(hex);

        // set all one-to-one indexes
        this.nameIndex.delete(name);

        // set all one-to-many indexes
        this.rarityIndex.get(rarity)?.delete(hex);
        this.ogIndex.get(`${og}`)?.delete(hex);
        this.charactersIndex.get(characters)?.delete(hex);
        this.numericModifiersIndex.get(numeric_modifiers)?.delete(hex);
        this.lengthIndex.get(`${length}`)?.delete(hex);

        // remove the stake key index
        this.holderAddressIndex.get(holder_address)?.hexes.delete(hex);
    };

    static setHolderAddressIndex(holderAddressDetails: AddressDetails, newHex: string, defaultName?: string) {
        // first get all the handles for the stake key
        const { address: holderAddress, knownOwnerName, type } = holderAddressDetails;

        const initialHolderAddressDetails: HolderAddressIndex = {
            hexes: new Set(),
            defaultHandle: '',
            manuallySet: false,
            type,
            knownOwnerName
        };

        const existingHolderAddressDetails = this.holderAddressIndex.get(holderAddress) ?? initialHolderAddressDetails;

        // add the new hex to the set
        existingHolderAddressDetails.hexes.add(newHex);

        const handles = [...existingHolderAddressDetails.hexes].reduce<IPersonalizedHandle[]>((agg, hex) => {
            const handle = this.handles.get(hex);
            if (handle) {
                agg.push(handle);
            } else {
                Logger.log({
                    message: `Handle ${hex} not found in holder address index, removing from hexes index`,
                    category: LogCategory.WARN
                });
                existingHolderAddressDetails.hexes.delete(hex);
            }
            return agg;
        }, []);

        // get the default handle or use the defaultName provided (this is used during personalization)
        const defaultHandle = defaultName ?? getDefaultHandle(handles)?.name ?? '';

        this.holderAddressIndex.set(holderAddress, {
            ...existingHolderAddressDetails,
            defaultHandle,
            manuallySet: !!defaultName
        });
    }

    static buildHandle = ({
        hexName,
        name,
        adaAddress,
        og,
        image,
        slotNumber,
        utxo,
        datum,
        background = '',
        default_in_wallet = '',
        profile_pic = '',
        personalization
    }: SaveMintingTxInput): IPersonalizedHandle => {
        const newHandle: IPersonalizedHandle = {
            hex: hexName,
            name,
            holder_address: '', // Populate on save
            length: name.length,
            utxo,
            rarity: getRarity(name),
            characters: buildCharacters(name),
            numeric_modifiers: buildNumericModifiers(name),
            resolved_addresses: {
                ada: adaAddress
            },
            og,
            original_nft_image: image,
            nft_image: image,
            background,
            default_in_wallet,
            profile_pic,
            created_slot_number: slotNumber,
            updated_slot_number: slotNumber,
            hasDatum: !!datum,
            datum: isDatumEndpointEnabled() && datum ? datum : undefined,
            personalization
        };

        return newHandle;
    };

    static buildHandleHistory(
        newHandle: Partial<IPersonalizedHandle>,
        oldHandle?: Partial<IPersonalizedHandle>
    ): HandleHistory | null {
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
            agg[key] = oldHandle[key as keyof IPersonalizedHandle];
            return agg;
        }, {});

        // Only save old details if the network is production.
        // Otherwise, save the new for testing purposes
        return NETWORK === 'production' ? { old } : { old, new: difference };
    }

    static saveSlotHistory({
        handleHistory,
        hex,
        slotNumber,
        maxSlots = this.twelveHourSlot
    }: {
        handleHistory: HandleHistory;
        hex: string;
        slotNumber: number;
        maxSlots?: number;
    }) {
        let slotHistory = HandleStore.slotHistoryIndex.get(slotNumber);
        if (!slotHistory) {
            slotHistory = {
                [hex]: handleHistory
            };
        } else {
            slotHistory[hex] = handleHistory;
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
        // TODO Check for existing handle. If there is one already, increase the amount property
        const newHandle = HandleStore.buildHandle(input);

        // Check for orphaned personalization data and delete if found.
        const { hex } = newHandle;
        const orphanedPersonalizationData = this.orphanedPersonalizationIndex.get(hex);
        if (orphanedPersonalizationData) {
            // if found, delete the orphaned personalization from the index
            this.orphanedPersonalizationIndex.delete(hex);

            // update history with the deleted personalization just in case there is a rollback
            const handleHistory: HandleHistory = {
                old: { personalization: orphanedPersonalizationData },
                new: null
            };

            HandleStore.saveSlotHistory({
                handleHistory,
                hex: `${MetadatumAssetLabel.REFERENCE_NFT}${hex}`,
                slotNumber: input.slotNumber
            });

            newHandle.personalization = orphanedPersonalizationData;
        }

        await HandleStore.save({ handle: newHandle });
    };

    static saveHandleUpdate = async ({ hexName, adaAddress, utxo, slotNumber, datum }: SaveWalletAddressMoveInput) => {
        const existingHandle = HandleStore.get(hexName);
        if (!existingHandle) {
            Logger.log({
                message: `Wallet moved, but there is no existing handle in storage with hex: ${hexName}`,
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
            hasDatum: !!datum,
            datum: isDatumEndpointEnabled() && datum ? datum : undefined
        };

        await HandleStore.save({
            handle: updatedHandle,
            oldHandle: existingHandle
        });
    };

    static saveOrphanedPersonalizationData = async ({
        hexName,
        personalization,
        slotNumber
    }: {
        hexName: string;
        personalization: IPersonalization;
        slotNumber: number;
    }) => {
        // If there is no handle, it means we have not received the 222 handle yet.
        // We will save the personalization in the orphaned personalization index and wait for the 222 handle.
        const existingOrphanedPersonalization = HandleStore.orphanedPersonalizationIndex.get(hexName);

        const updatedPersonalization = existingOrphanedPersonalization
            ? {
                  ...existingOrphanedPersonalization,
                  ...personalization
              }
            : { ...personalization };

        const orphanedPersonalizationHistory = HandleStore.buildHandleHistory(
            { personalization: updatedPersonalization },
            existingOrphanedPersonalization ? { personalization: existingOrphanedPersonalization } : undefined
        );

        if (orphanedPersonalizationHistory) {
            HandleStore.saveSlotHistory({
                handleHistory: orphanedPersonalizationHistory,
                hex: `${MetadatumAssetLabel.REFERENCE_NFT}${hexName}`,
                slotNumber
            });
        }

        HandleStore.orphanedPersonalizationIndex.set(hexName, personalization);
    };

    static async savePersonalizationChange({
        hexName,
        personalization,
        addresses,
        slotNumber
    }: SavePersonalizationInput) {
        const existingHandle = HandleStore.get(hexName);
        if (!existingHandle) {
            HandleStore.saveOrphanedPersonalizationData({ hexName, personalization, slotNumber });
            return;
        }

        // update resolved addresses
        // remove ada from the new addresses.
        if (addresses.ada) {
            delete addresses.ada;
        }

        const updatedHandle: IPersonalizedHandle = {
            ...existingHandle,
            // TODO: Change this to the correct property
            nft_image: personalization?.nft_appearance?.pfpImageUrl ?? '',
            background: personalization?.nft_appearance?.backgroundImageUrl ?? '',
            profile_pic: personalization?.nft_appearance?.pfpImageUrl ?? '',
            default_in_wallet: '', // TODO: figure out how this is updated
            updated_slot_number: slotNumber,
            resolved_addresses: {
                ada: existingHandle.resolved_addresses.ada,
                ...addresses
            },
            personalization
        };

        await HandleStore.save({
            handle: updatedHandle,
            oldHandle: existingHandle
        });
    }

    static convertMapsToObjects = <T>(mapInstance: Map<string, T>) => {
        return Array.from(mapInstance).reduce<Record<string, T>>((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
    };

    static memorySize() {
        const object = {
            ...this.convertMapsToObjects(this.handles),
            ...this.convertMapsToObjects(this.nameIndex),
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
            percentageComplete,
            currentMemoryUsed,
            ogmiosElapsed,
            buildingElapsed,
            slotDate,
            handleCount,
            memorySize,
            currentSlot,
            currentBlockHash
        };
    }

    static isCaughtUp(): boolean {
        const { firstSlot = 0, lastSlot = 0, currentSlot = 0 } = this.metrics;
        const handleSlotRange = lastSlot - firstSlot;
        const currentSlotInRange = currentSlot - firstSlot;
        const percentageComplete =
            currentSlot === 0 ? '0.00' : ((currentSlotInRange / handleSlotRange) * 100).toFixed(2);

        const slotDate = getDateStringFromSlot(currentSlot);

        const date = slotDate.getTime();
        const now = new Date().getTime();

        return date < now - 60000 && percentageComplete != `100.00`;
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
        const orphanedPz = Array.from(HandleStore.orphanedPersonalizationIndex);
        storagePath = storagePath ?? this.storageFilePath;
        Logger.log(`Saving file with ${this.handles.size} handles & ${history.length} history entries`);
        const result = await HandleStore.saveFileContents({
            content: { handles, history, orphanedPz },
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
                throw msg;
            });
        } catch (error: any) {
            Logger.log({
                message: `Error writing file: ${error.message}`,
                event: 'saveFileContents.errorSavingFile',
                category: error.message === 'Lock file is already being held' ? LogCategory.INFO : LogCategory.ERROR
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
                orphanedPz: content.orphanedPz,
                slot: content.slot,
                schemaVersion: content.schemaVersion ?? 0,
                hash: content.hash,
                isNew
            };
        };

        let filesContent: {
            handles: Record<string, IPersonalizedHandle>;
            history: [number, ISlotHistoryIndex][];
            orphanedPz: [string, IPersonalization][];
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

        const { handles, slot, hash, history, orphanedPz, isNew } = filesContent;

        // save all the individual handles to the store
        const keys = Object.keys(handles ?? {});
        for (let i = 0; i < keys.length; i++) {
            const hex = keys[i];
            const handle = handles[hex];
            const newHandle = {
                ...handle
            };
            // delete the personalization object from the handle so we don't double store it
            await HandleStore.save({ handle: newHandle, saveHistory: false });
        }

        // save the slot history to the store
        HandleStore.slotHistoryIndex = new Map(history);
        HandleStore.orphanedPersonalizationIndex = new Map(orphanedPz);

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
        this.handles = new Map<string, IPersonalizedHandle>();
        this.orphanedPersonalizationIndex = new Map<string, IPersonalization>();
        this.holderAddressIndex = new Map<string, HolderAddressIndex>();
        this.nameIndex = new Map<string, string>();
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
    }): Promise<void> {
        // first we need to order the historyIndex desc by slot
        const orderedHistoryIndex = [...this.slotHistoryIndex.entries()].sort((a, b) => b[0] - a[0]);
        let handleUpdates = 0;
        let handleDeletes = 0;
        let orphanedPzUpdates = 0;
        let orphanedPzDeletes = 0;

        // iterate through history starting with the most recent up to the slot we want to rewind to.
        for (const item of orderedHistoryIndex) {
            const [slotKey, history] = item;

            // once we reach the slot we want to rewind to, we can stop
            if (slotKey <= slot) {
                Logger.log({
                    message: `Finished Rewinding to slot ${slot} with ${handleUpdates} handle updates, ${handleDeletes} handle deletes, ${orphanedPzUpdates} orphaned personalization updates, and ${orphanedPzDeletes} orphaned personalization deletes`,
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
                const hex = keys[i];

                // check to see if it's a reference token. If so, update the reference token
                if (hex.startsWith(MetadatumAssetLabel.REFERENCE_NFT)) {
                    const hexWithoutTokenClass = hex.replace(MetadatumAssetLabel.REFERENCE_NFT, '');
                    const existingOrphanedPersonalization =
                        HandleStore.orphanedPersonalizationIndex.get(hexWithoutTokenClass);
                    if (!existingOrphanedPersonalization) {
                        Logger.log(`Orphaned Personalization ${hexWithoutTokenClass} does not exist`);
                        continue;
                    }

                    const personalizationHistory = history[hex];
                    if (personalizationHistory.old === null) {
                        HandleStore.orphanedPersonalizationIndex.delete(hexWithoutTokenClass);
                        orphanedPzDeletes++;
                        continue;
                    }

                    const updatedPersonalization: IPersonalization = {
                        ...existingOrphanedPersonalization,
                        ...personalizationHistory.old.personalization
                    };

                    HandleStore.orphanedPersonalizationIndex.set(hexWithoutTokenClass, updatedPersonalization);
                    orphanedPzUpdates++;
                    continue;
                }

                const existingHandle = this.get(hex);
                if (!existingHandle) {
                    Logger.log(`Handle ${hex} does not exist`);
                    continue;
                }

                const handleHistory = history[hex];

                if (handleHistory.old === null) {
                    // if the old value is null, then the handle was deleted
                    // so we need to remove it from the indexes
                    await this.remove(hex);
                    handleDeletes++;
                    continue;
                }

                // otherwise we need to update the handle with the old values
                const updatedHandle: IPersonalizedHandle = {
                    ...existingHandle,
                    ...handleHistory.old
                };

                await this.save({ handle: updatedHandle, oldHandle: existingHandle, saveHistory: false });
                handleUpdates++;
            }

            // delete the slot key since we are rolling back to it
            this.slotHistoryIndex.delete(slotKey);
        }
    }
}
