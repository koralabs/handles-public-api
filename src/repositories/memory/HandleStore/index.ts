import { IHandle, IHandleStats, IPersonalization } from '@koralabs/handles-public-api-interfaces';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import fetch from 'cross-fetch';
import fs from 'fs';
import lockfile from 'proper-lockfile';
import { diff } from 'deep-object-diff';
import { NETWORK, NODE_ENV } from '../../../config';
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
    IHandleHistoryFileContent
} from '../interfaces/handleStore.interfaces';
export class HandleStore {
    // Indexes
    private static handles = new Map<string, IHandle>();
    static personalization = new Map<string, IPersonalization>();
    static slotHistoryIndex = new Map<number, ISlotHistoryIndex>();
    static holderAddressIndex = new Map<string, HolderAddressIndex>();
    static nameIndex = new Map<string, string>();
    static rarityIndex = new Map<string, Set<string>>();
    static ogIndex = new Map<string, Set<string>>();
    static charactersIndex = new Map<string, Set<string>>();
    static numericModifiersIndex = new Map<string, Set<string>>();
    static lengthIndex = new Map<string, Set<string>>();

    static storageFolder = process.env.HANDLES_STORAGE || `${process.cwd()}/handles`;
    static storageSchemaVersion = 3;
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

    static buildNetworkForNaming = () => {
        if (NETWORK === 'mainnet') {
            return '';
        }

        return `-${NETWORK}`;
    };

    static storageFileName = `handles${HandleStore.buildNetworkForNaming()}.json`;
    static storageFilePath = `${HandleStore.storageFolder}/${HandleStore.storageFileName}`;

    static historyFileName = `history${HandleStore.buildNetworkForNaming()}.json`;
    static historyFilePath = `${HandleStore.storageFolder}/${HandleStore.historyFileName}`;

    static get = (key: string): IHandle | null => {
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

    static getPersonalization = (key: string) => {
        return this.personalization.get(key);
    };

    static count = () => {
        return this.handles.size;
    };

    static getHandles = () => {
        const handles = Array.from(HandleStore.handles, ([_, value]) => ({ ...value } as IHandle));
        return handles.map((handle) => {
            const existingHandle = HandleStore.get(handle.hex) as IHandle;
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
        personalization,
        saveHistory = true
    }: {
        handle: IHandle;
        oldHandle?: IHandle;
        personalization?: IPersonalization;
        saveHistory?: boolean;
    }) => {
        const updatedHandle = JSON.parse(JSON.stringify(handle));
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

        // set the personalization index
        if (personalization) {
            this.personalization.set(hex, personalization);
        }

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

        if (saveHistory) {
            const history = HandleStore.buildHandleHistory(updatedHandle, oldHandle, personalization);
            if (history) HandleStore.saveSlotHistory({ handleHistory: history, hex, slotNumber: updated_slot_number });
        }
    };

    static remove = async (hexName: string) => {
        Logger.log({ category: LogCategory.INFO, message: `Removing handle ${hexName}`, event: 'HandleStore.remove' });

        const handle = this.handles.get(hexName);
        if (!handle) {
            return;
        }

        const {
            name,
            rarity,
            holder_address,
            og,
            characters,
            numeric_modifiers,
            length,
            hex,
            resolved_addresses: { ada }
        } = handle;

        // Set the main index
        this.handles.delete(hex);

        // set the personalization index
        this.personalization.delete(hex);

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

        const handles = [...existingHolderAddressDetails.hexes].map((hex) => this.handles.get(hex) as IHandle);

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
        background = '',
        default_in_wallet = '',
        profile_pic = ''
    }: SaveMintingTxInput): IHandle => {
        const newHandle: IHandle = {
            hex: hexName,
            name,
            holder_address: '', // Populate on save
            length: name.length,
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
            updated_slot_number: slotNumber
        };

        return newHandle;
    };

    static buildHandleHistory(
        newHandle: IHandle,
        oldHandle?: IHandle,
        personalization?: IPersonalization
    ): HandleHistory | null {
        const { name } = newHandle;
        if (!oldHandle) {
            return NODE_ENV !== 'production' ? { old: null, new: { name } } : { old: null };
        }

        // the diff will give us only properties that have been updated
        const difference = diff({ ...oldHandle, personalization }, { ...newHandle, personalization });
        if (Object.keys(difference).length === 0) {
            return null;
        }

        // using the diff, we need to get the same properties from oldHandle
        const old = Object.keys(difference).reduce<Record<string, unknown>>((agg, key) => {
            agg[key] = oldHandle[key as keyof IHandle];
            return agg;
        }, {});

        return NETWORK !== 'production' ? { old, new: difference } : { old };
    }

    static saveSlotHistory({
        handleHistory,
        hex,
        slotNumber,
        maxSlots = 43200 // value comes from the securityParam here: https://cips.cardano.org/cips/cip9/#nonupdatableparameters then converted to slots
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
        const newHandle: IHandle = HandleStore.buildHandle(input);
        await HandleStore.save({ handle: newHandle });
    };

    static saveWalletAddressMove = async ({ hexName, adaAddress, slotNumber }: SaveWalletAddressMoveInput) => {
        const existingHandle = HandleStore.get(hexName);
        if (!existingHandle) {
            Logger.log({
                message: `Wallet moved, but there is no existing handle in storage with hex: ${hexName}`,
                category: LogCategory.ERROR,
                event: 'saveWalletAddressMove.noHandleFound'
            });
            return;
        }

        const updatedHandle = {
            ...existingHandle,
            resolved_addresses: { ada: adaAddress },
            updated_slot_number: slotNumber
        };

        await HandleStore.save({ handle: updatedHandle, oldHandle: existingHandle });
    };

    static async savePersonalizationChange({
        hexName,
        personalization,
        addresses,
        slotNumber
    }: SavePersonalizationInput) {
        const existingHandle = HandleStore.get(hexName);
        if (!existingHandle) {
            Logger.log({
                message: `Wallet moved, but there is no existing handle in storage with hex: ${hexName}`,
                category: LogCategory.ERROR,
                event: 'saveWalletAddressMove.noHandleFound'
            });
            return;
        }

        // update resolved addresses
        // remove ada from the new addresses.
        if (addresses.ada) {
            delete addresses.ada;
        }

        const updatedHandle = {
            ...existingHandle,
            nft_image: personalization?.nft_appearance?.image ?? '',
            background: personalization?.nft_appearance?.background ?? '',
            profile_pic: personalization?.nft_appearance?.profilePic ?? '',
            default_in_wallet: '', // TODO: figure out how this is updated
            updated_slot_number: slotNumber,
            resolved_addresses: {
                ada: existingHandle.resolved_addresses.ada,
                ...addresses
            }
        };

        await HandleStore.save({ handle: updatedHandle, oldHandle: existingHandle, personalization });
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
        processing?: Function
    ): Promise<boolean> {
        const handles = {
            ...this.convertMapsToObjects(this.handles)
        };
        const path = storagePath ?? this.storageFilePath;
        Logger.log(`Saving file with ${this.handles.size} handles`);
        const result = await HandleStore.saveFileContents({ content: { handles }, path, slot, hash, processing });
        return result;
    }

    static async saveSlotHistoryFile(
        slot: number,
        hash: string,
        storagePath?: string,
        processing?: Function
    ): Promise<boolean> {
        const history = Array.from(HandleStore.slotHistoryIndex);
        const path = storagePath ?? this.historyFilePath;
        Logger.log(`Saving file with ${history.length} history entries`);
        const result = await HandleStore.saveFileContents({ content: { history }, path, slot, hash, processing });
        return result;
    }

    static async saveFileContents({
        content,
        path,
        slot,
        hash,
        processing
    }: {
        path: string;
        content?: any;
        slot?: number;
        hash?: string;
        processing?: Function;
    }): Promise<boolean> {
        try {
            const isLocked = await lockfile.check(path);
            if (isLocked) {
                Logger.log('Unable to save. History file is locked');
                return false;
            }

            const release = await lockfile.lock(path);

            // if there is no content, hash or slot we can assume we are going to clear the file
            const fileContent =
                content && hash && slot
                    ? JSON.stringify({
                          slot,
                          hash,
                          schemaVersion: this.storageSchemaVersion,
                          ...content
                      })
                    : '';

            fs.writeFileSync(path, fileContent);

            if (processing) await processing();

            await release();
            return true;
        } catch (error: any) {
            Logger.log({
                message: `Error writing file: ${error.message}`,
                event: 'saveFileContents.errorSavingFile',
                category: error.message === 'Lock file is already being held' ? LogCategory.INFO : LogCategory.ERROR
            });
            return false;
        }
    }

    static checkIfExists(path: string): boolean {
        try {
            const exists = fs.statSync(path);
            if (exists) {
                return true;
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    static async getFile<T>(storagePath: string): Promise<T | null> {
        const path = NODE_ENV === 'local' ? 'storage/local.json' : storagePath;

        try {
            const exists = this.checkIfExists(path);
            if (!exists) {
                Logger.log({
                    message: `${path} file does not exist`,
                    category: LogCategory.INFO,
                    event: 'HandleStore.getFile.doesNotExist'
                });
                return null;
            }

            const isLocked = await lockfile.check(path);
            if (isLocked) {
                Logger.log({
                    message: `${path} file is locked`,
                    category: LogCategory.INFO,
                    event: 'HandleStore.getFile.locked'
                });
                return null;
            }

            const file = fs.readFileSync(path, { encoding: 'utf8' });
            Logger.log({
                message: `${path} found`,
                category: LogCategory.INFO,
                event: 'HandleStore.getFile.fileFound'
            });

            return JSON.parse(file) as T;
        } catch (error: any) {
            Logger.log(`Error getting file from ${path} with error: ${error.message}`);
            return null;
        }
    }

    static async getFileOnline<T>(fileName: string): Promise<T | null> {
        if (NODE_ENV === 'local') {
            return null;
        }

        try {
            const url = `http://api.handle.me.s3-website-us-west-2.amazonaws.com/${this.storageSchemaVersion}/${fileName}`;
            Logger.log(`Fetching ${url}`);
            const awsResponse = await fetch(url);
            if (awsResponse.status === 200) {
                const text = await awsResponse.text();
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
        const [externalHandles, externalHistory, localHandles, localHistory] = await Promise.all([
            HandleStore.getFileOnline<IHandleFileContent>(this.storageFileName),
            HandleStore.getFileOnline<IHandleHistoryFileContent>(this.historyFileName),
            HandleStore.getFile<IHandleFileContent>(this.storageFilePath),
            HandleStore.getFile<IHandleHistoryFileContent>(this.historyFilePath)
        ]);

        const fileContentsMatch = (
            handleFileContent: IHandleFileContent,
            historyFileContent: IHandleHistoryFileContent
        ) => {
            return (
                handleFileContent &&
                historyFileContent &&
                handleFileContent.slot === historyFileContent.slot &&
                handleFileContent.schemaVersion === historyFileContent.schemaVersion
            );
        };

        // first, do some validation on the files by checking if the slot and schema version match
        const externalContent =
            externalHandles && externalHistory && fileContentsMatch(externalHandles, externalHistory)
                ? { handles: externalHandles, history: externalHistory }
                : null;

        const localContent =
            localHandles &&
            localHistory &&
            fileContentsMatch(localHandles, localHistory) &&
            (localHandles?.schemaVersion ?? 0) >= this.storageSchemaVersion
                ? { handles: localHandles, history: localHistory }
                : null;

        // If we don't have any valid files, return null
        if (!externalContent && !localContent) {
            Logger.log({
                message: 'No valid files found',
                category: LogCategory.INFO,
                event: 'HandleStore.prepareHandlesStorage.noValidFilesFound'
            });
            return null;
        }

        const buildFilesContent = (
            content: { handles: IHandleFileContent; history: IHandleHistoryFileContent },
            isNew = false
        ) => {
            return {
                handles: content.handles,
                history: content.history,
                slot: content.handles.slot,
                schemaVersion: content.handles.schemaVersion ?? 0,
                hash: content.handles.hash,
                isNew
            };
        };

        let filesContent: {
            handles: IHandleFileContent;
            history: IHandleHistoryFileContent;
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
            if (
                // check to see if the local file slot and schema version are greater than the external file
                // if so, use the local file otherwise use the external file
                localContent.handles.slot > externalContent.handles.slot &&
                (localContent.handles.schemaVersion ?? 0) >= (externalContent.handles.schemaVersion ?? 0)
            ) {
                filesContent = buildFilesContent(localContent);
            } else {
                filesContent = buildFilesContent(externalContent, true);
            }
        }

        // At this point, we should have a valid filesContent object.
        // If we don't perform this check we'd have to use a large terinary operator which is pretty ugly
        if (!filesContent) {
            return null;
        }

        const {
            handles: { handles },
            slot,
            hash,
            history: { history },
            isNew
        } = filesContent;

        // save all the individual handles to the store
        const keys = Object.keys(handles ?? {});
        for (let i = 0; i < keys.length; i++) {
            const hex = keys[i];
            const handle = handles[hex];
            const newHandle = {
                ...handle
            };
            // delete the personalization object from the handle so we don't double store it
            delete newHandle.personalization;
            await HandleStore.save({ handle: newHandle, personalization: handle.personalization, saveHistory: false });
        }

        // save the slot history to the store
        HandleStore.slotHistoryIndex = new Map(history);

        Logger.log(
            `Handle storage found at slot: ${slot} and hash: ${hash} with ${Object.keys(handles ?? {}).length} handles`
        );

        // if the file contents are new (from the external source), save the handles and history to the store.
        if (isNew) {
            await HandleStore.saveHandlesFile(slot, hash);
            await HandleStore.saveSlotHistoryFile(slot, hash);
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
        this.handles = new Map<string, IHandle>();
        this.personalization = new Map<string, IPersonalization>();
        this.holderAddressIndex = new Map<string, HolderAddressIndex>();
        this.nameIndex = new Map<string, string>();
        this.rarityIndex = new Map<string, Set<string>>();
        this.ogIndex = new Map<string, Set<string>>();
        this.charactersIndex = new Map<string, Set<string>>();
        this.numericModifiersIndex = new Map<string, Set<string>>();
        this.lengthIndex = new Map<string, Set<string>>();

        // clear storage files
        await HandleStore.saveFileContents({ path: HandleStore.storageFilePath });
        await HandleStore.saveFileContents({ path: HandleStore.historyFilePath });
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

        // iterate through history starting with the most recent up to the slot we want to rewind to.
        for (const item of orderedHistoryIndex) {
            const [slotKey, history] = item;

            // once we reach the slot we want to rewind to, we can stop
            if (slotKey === slot) {
                Logger.log({
                    message: `Rewound to slot ${slot}`,
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
                const existingHandle = this.get(hex);
                if (!existingHandle) {
                    Logger.log(`Handle ${hex} does not exist`);
                    continue;
                }

                const handleHistory = history[hex];

                if (handleHistory.old === null) {
                    // if the old value is null, then the handle was deleted
                    // so we need to remove it from the indexes
                    this.remove(hex);
                    continue;
                }

                // otherwise we need to update the handle with the old values
                const updatedHandle: IHandle = {
                    ...existingHandle,
                    ...handleHistory.old
                };

                await this.save({ handle: updatedHandle, saveHistory: false });
            }

            // delete the slot key since we are rolling back to it
            this.slotHistoryIndex.delete(slotKey);
        }
    }
}
