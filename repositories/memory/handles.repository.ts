import {
    AddressDetails,
    AssetNameLabel,
    bech32FromHex,
    buildCharacters,
    buildDrep,
    buildNumericModifiers,
    decodeAddress,
    diff,
    getAddressHolderDetails,
    getDateStringFromSlot,
    getElapsedTime,
    getPaymentKeyHash,
    getRarity,
    HandleHistory,
    HandlePaginationModel, HandleSearchModel,
    HandleType,
    HolderAddressDetails,
    HolderAddressIndex,
    HolderPaginationModel,
    HttpException,
    IHandleFileContent,
    IHandlesRepository,
    IHandleStats,
    IHandleStoreMetrics,
    ISlotHistoryIndex,
    IUTxO,
    LogCategory, Logger,
    NETWORK,
    SaveMintingTxInput, SavePersonalizationInput, SaveSubHandleSettingsInput, SaveWalletAddressMoveInput,
    StoredHandle
} from '@koralabs/kora-labs-common';
import * as crypto from 'crypto';
import fs from 'fs';
import { promisify } from 'util';
import { Worker } from 'worker_threads';
import { inflate } from 'zlib';
import { DISABLE_HANDLES_SNAPSHOT, isDatumEndpointEnabled, NODE_ENV } from '../../config';
import { memoryWatcher } from '../../services/ogmios/utils';
import { getDefaultHandle } from '../../utils/getDefaultHandle';
import { HandleStore } from './handleStore';

export class MemoryHandlesRepository implements IHandlesRepository {
    public EMPTY = '|empty|';
    private intervals: NodeJS.Timeout[] = [];
    private twelveHourSlot = 43200; // value comes from the securityParam here: https://cips.cardano.org/cips/cip9/#nonupdatableparameters then converted to slots
    private storageFolder = process.env.HANDLES_STORAGE || `${process.cwd()}/handles`;
    private _storageSchemaVersion = 40;
    private metrics: IHandleStoreMetrics = {
        firstSlot: 0,
        lastSlot: 0,
        currentSlot: 0,
        elapsedOgmiosExec: 0,
        elapsedBuildingExec: 0,
        firstMemoryUsage: 0,
        currentBlockHash: '',
        memorySize: 0
    };

    private storageFileName = `handles.json`;
    private storageFilePath = `${this.storageFolder}/${NETWORK}/snapshot/${this.storageFileName}`;

    public get(key: string): StoredHandle | null {
        const handle = HandleStore.handles.get(key);

        return this.returnHandleWithDefault(handle);
    }

    public getByHex(hex: string): StoredHandle | null {
        let handle: StoredHandle | null = null;
        for (const [ , value] of HandleStore.handles.entries()) {
            if (value.hex === hex) handle = value;
            break;
        }
        return this.returnHandleWithDefault(handle);
    }

    public initialize(): IHandlesRepository {
        if (this.intervals.length === 0) {
            const saveFilesInterval = setInterval(() => {
                const { current_slot, current_block_hash } = this.getMetrics();

                // currentSlot should never be zero. If it is, we don't want to write it and instead exit.
                // Once restarted, we should have a valid file to read from.
                if (current_slot === 0) {
                    Logger.log({
                        message: 'Slot is zero. Exiting process.',
                        category: LogCategory.NOTIFY,
                        event: 'OgmiosService.saveFilesInterval'
                    });
                    process.exit(2);
                }

                this._saveHandlesFile(current_slot, current_block_hash);

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

    public getHandles() {
        const handles = Array.from(HandleStore.handles, ([_, value]) => ({ ...value } as StoredHandle));
        return handles.map((handle) => {
            const existingHandle = this.get(handle.name) as StoredHandle;
            return existingHandle;
        });
    }

    private addIndexSet(indexSet: Map<string, Set<string>>, indexKey: string, handleName: string) {
        const set = indexSet.get(indexKey) ?? new Set();
        set.add(handleName);
        indexSet.set(indexKey, set);
    }

    private _getRootHandleSubHandles (rootHandle: string) {
        return HandleStore.subHandlesIndex.get(rootHandle) ?? new Set();
    }

    protected async _save({ handle, oldHandle, saveHistory = true }: { handle: StoredHandle; oldHandle?: StoredHandle; saveHistory?: boolean }) {
        const updatedHandle: StoredHandle = JSON.parse(JSON.stringify(handle, (k, v) => (typeof v === 'bigint' ? parseInt(v.toString() || '0') : v)));
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
        const payment_key_hash = (await getPaymentKeyHash(ada))!;
        updatedHandle.payment_key_hash = payment_key_hash;
        updatedHandle.drep = buildDrep(ada, updatedHandle.id_hash?.replace('0x', ''));
        updatedHandle.holder = updatedHandle.drep ? updatedHandle.drep.cip_129 : holder.address;
        updatedHandle.holder_type = updatedHandle.drep ? 'drep': holder.type;
        const handleDefault = handle.default;
        delete handle.default; // This is a temp property not meant to save to the handle

        // Set the main index
        HandleStore.handles.set(name, updatedHandle);

        // Set default name during personalization
        this.setHolderAddressIndex(holder, name, handleDefault, oldHandle?.holder);

        // set all one-to-many indexes
        this.addIndexSet(HandleStore.rarityIndex, rarity, name);

        const ogFlag = og_number === 0 ? 0 : 1;
        this.addIndexSet(HandleStore.ogIndex, `${ogFlag}`, name);
        this.addIndexSet(HandleStore.charactersIndex, characters, name);
        this.addIndexSet(HandleStore.paymentKeyHashesIndex, payment_key_hash, name);
        this.addIndexSet(HandleStore.numericModifiersIndex, numeric_modifiers, name);
        this.addIndexSet(HandleStore.lengthIndex, `${length}`, name);

        if (name.includes('@')) {
            const rootHandle = name.split('@')[1];
            this.addIndexSet(HandleStore.subHandlesIndex, rootHandle, name);
        }

        if (holder.address && holder.address != '') {
            // This could return null if it is a pre-Shelley address (not bech32)
            const decodedAddress = decodeAddress(holder.address);
            const oldDecodedAddress = decodeAddress(`${oldHandle?.holder}`);
            if (decodedAddress) {
                if (oldDecodedAddress) {
                    // if there is an old stake key hash, remove it from the index
                    const oldHashofStakeKeyHash = crypto.createHash('md5').update(oldDecodedAddress.slice(2), 'hex').digest('hex')
                    HandleStore.hashOfStakeKeyHashIndex.get(oldHashofStakeKeyHash)?.delete(name);                    
                }
                const hashofStakeKeyHash = crypto.createHash('md5').update(decodedAddress.slice(2), 'hex').digest('hex')
                this.addIndexSet(HandleStore.hashOfStakeKeyHashIndex, hashofStakeKeyHash, name);
            }
        }

        HandleStore.addressesIndex.get(oldHandle?.resolved_addresses.ada!)?.delete(name); 
        this.addIndexSet(HandleStore.addressesIndex, ada, name);

        // This is commented out for now as we might not need it since the history gets cleaned up on every call
        // const isWithinMaxSlot = this.metrics.lastSlot && this.metrics.currentSlot && this.metrics.lastSlot - this.metrics.currentSlot < this.twelveHourSlot;
        const isWithinMaxSlot = true;

        if (saveHistory && isWithinMaxSlot) {
            const history = this._buildHandleHistory(updatedHandle, oldHandle);
            if (history)
                this._saveSlotHistory({
                    handleHistory: history,
                    handleName: name,
                    slotNumber: updated_slot_number
                });
        }
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


    public destroy(): void {
        this.intervals.map((i) => clearInterval(i));
    }
    
    public getMetrics(): IHandleStats {        
        const { firstSlot = 0, lastSlot = 0, currentSlot = 0, firstMemoryUsage = 0, elapsedOgmiosExec = 0, elapsedBuildingExec = 0, currentBlockHash = '', memorySize = 0 } = this.metrics;

        const handleSlotRange = lastSlot - firstSlot;
        const currentSlotInRange = currentSlot - firstSlot;

        const handleCount = this.count();

        const percentageComplete = currentSlot === 0 ? '0.00' : ((currentSlotInRange / handleSlotRange) * 100).toFixed(2);

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
            schema_version: this._storageSchemaVersion
        };
    }
    
    private search(searchModel: HandleSearchModel) {
        const { characters, length, rarity, numeric_modifiers, search, holder_address, og, handle_type, handles } = searchModel;

        // helper function to get a list of hashes from the Set indexes
        const getHandles = (index: Map<string, Set<string>>, key: string | undefined) => {
            if (!key) return [];

            const array = Array.from(index.get(key) ?? [], (value) => value);
            return array.length === 0 ? [this.EMPTY] : array;
        };

        // get handle name arrays for all the search parameters
        const characterArray = getHandles(HandleStore.charactersIndex, characters);
        let lengthArray: string[] = [];
        if (length?.includes('-')) {
            for (let i = parseInt(length.split('-')[0]); i <= parseInt(length.split('-')[1]); i++) {
                lengthArray = lengthArray.concat(getHandles(HandleStore.lengthIndex, `${i}`));
            }
        } else {
            lengthArray = getHandles(HandleStore.lengthIndex, length);
        }
        const rarityArray = getHandles(HandleStore.rarityIndex, rarity);
        const numericModifiersArray = getHandles(HandleStore.numericModifiersIndex, numeric_modifiers);
        const ogArray = og ? getHandles(HandleStore.ogIndex, '1') : [];

        const getHolderAddressHandles = (key: string | undefined) => {
            if (!key) return [];

            const array = Array.from(HandleStore.holderAddressIndex.get(key)?.handles ?? [], (value) => value);
            return array.length === 0 ? [this.EMPTY] : array;
        };

        const holderAddressItemsArray = getHolderAddressHandles(holder_address);

        // filter out any empty arrays
        const filteredArrays = [characterArray, lengthArray, rarityArray, numericModifiersArray, holderAddressItemsArray, ogArray].filter((a) => a.length);

        // get the intersection of all the arrays
        const handleNames = filteredArrays.length ? filteredArrays.reduce((a, b) => a.filter((c) => b.includes(c))) : [];

        // remove duplicates by getting the unique names
        const uniqueHandleNames = [...new Set(handleNames)];

        // remove the empty names
        const nonEmptyHandles = uniqueHandleNames.filter((name) => name !== this.EMPTY);

        let array =
            characters || length || rarity || numeric_modifiers || holder_address || og
                ? nonEmptyHandles.reduce<StoredHandle[]>((agg, name) => {
                    const handle = this.get(name as string);
                    if (handle) {
                        if (search && !handle.name.includes(search)) return agg;
                        if (handle_type && handle.handle_type !== handle_type) return agg;
                        if (handles && !handles.includes(handle.name)) return agg;
                        agg.push(handle);
                    }
                    return agg;
                }, [])
                : this.getHandles().reduce<StoredHandle[]>((agg, handle) => {
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

    public async getAll({ pagination, search }: { pagination: HandlePaginationModel; search: HandleSearchModel }): Promise<{ searchTotal: number; handles: StoredHandle[] }> {
        const { page, sort, handlesPerPage, slotNumber } = pagination;

        let items = this.search(search);

        if (slotNumber) {
            items.sort((a, b) => (sort === 'desc' ? b.updated_slot_number - a.updated_slot_number : a.updated_slot_number - b.updated_slot_number));
            const slotNumberIndex = items.findIndex((a) => a.updated_slot_number === slotNumber) ?? 0;
            const handles = items.slice(slotNumberIndex, slotNumberIndex + handlesPerPage);

            return { searchTotal: items.length, handles };
        }

        items.sort((a, b) => (sort === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));

        if (sort === 'random') {
            items = items
                .map((value) => ({ value, sort: Math.random() }))
                .sort((a, b) => a.sort - b.sort)
                .map(({ value }) => value);
        } else {
            items.sort((a, b) => (sort === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
        }

        const startIndex = (page - 1) * handlesPerPage;
        const handles = items.slice(startIndex, startIndex + handlesPerPage);

        return { searchTotal: items.length, handles };
    }

    public async getAllHolders({ pagination }: { pagination: HolderPaginationModel }): Promise<HolderAddressDetails[]> {
        const { page, sort, recordsPerPage } = pagination;

        const items: HolderAddressDetails[] = [];
        HandleStore.holderAddressIndex.forEach((holder, address) => {
            if (holder) {
                const { handles, defaultHandle, manuallySet, type, knownOwnerName } = holder;
                items.push({
                    total_handles: handles.size,
                    default_handle: defaultHandle,
                    manually_set: manuallySet,
                    address,
                    known_owner_name: knownOwnerName,
                    type
                });
            }
        });

        items.sort((a, b) => (sort === 'desc' ? b.total_handles - a.total_handles : a.total_handles - b.total_handles));
        const startIndex = (page - 1) * recordsPerPage;
        const holders = items.slice(startIndex, startIndex + recordsPerPage);

        return holders;
    }

    public async getAllHandleNames(search: HandleSearchModel, sort: string) {
        const handles = this.search(search);
        const filteredHandles = handles.filter((handle) => !!handle.utxo);
        if (sort === 'random') {
            const shuffledHandles = filteredHandles
                .map((value) => ({ value, sort: Math.random() }))
                .sort((a, b) => a.sort - b.sort)
                .map(({ value }) => value);
            return shuffledHandles.map((handle) => handle.name);
        } else {
            filteredHandles.sort((a, b) => (sort === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
        }
        return filteredHandles.map((handle) => handle.name);
    }

    public getHandlesByPaymentKeyHashes = (hashes: string[]): string[]  => {
        return hashes.map((h) => {
            const array = Array.from(HandleStore.paymentKeyHashesIndex.get(h) ?? []);
            return array.length === 0 ? [this.EMPTY] : array;
        }
        ).flat();
    }

    public getHandlesByHolderAddresses = (addresses: string[]): string[]  => {
        return addresses.map((h) => {
            const array = Array.from(HandleStore.holderAddressIndex.get(h)?.handles ?? []);
            return array.length === 0 ? [this.EMPTY] : array;
        }
        ).concat(addresses.map((h) => {
            const hashed = crypto.createHash('md5').update(decodeAddress(h)!.slice(2), 'hex').digest('hex');
            const array = Array.from(HandleStore.hashOfStakeKeyHashIndex.get(hashed!) ?? []);
            return array.length === 0 ? [this.EMPTY] : array;
        })).flat() as string[];
    }

    public getHandlesByStakeKeyHashes = (hashes: string[]): string[]  => {
        return hashes.map((h) => {
            const hashed = crypto.createHash('md5').update(h, 'hex').digest('hex');
            const array = Array.from(HandleStore.hashOfStakeKeyHashIndex.get(hashed!) ?? []);
            return array.length === 0 ? [this.EMPTY] : array;
        }).flat() as string[];
    }

    public getHandlesByAddresses = (addresses: string[]): string[]  => {
        return addresses.map((h) => {
            const array = Array.from(HandleStore.addressesIndex.get(h) ?? []);
            return array.length === 0 ? [this.EMPTY] : array;
        }
        ).flat();
    }

    public async getHandleByName(handleName: string): Promise<StoredHandle | null> {
        const handle = this.get(handleName);
        if (handle) return handle;

        return null;
    }

    public async getHandleByHex(handleHex: string): Promise<StoredHandle | null> {
        const handle = this.getByHex(handleHex);
        if (handle) return handle;

        return null;
    }

    public async getHolderAddressDetails(key: string): Promise<HolderAddressDetails> {
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

    public async getHandleDatumByName(handleName: string): Promise<string | null> {
        const handle = this.get(handleName);
        if (!handle || !handle.utxo) {
            throw new HttpException(404, 'Not found');
        }

        const { has_datum, datum = null } = handle;
        if (!has_datum) return null;
        return datum;
    }

    public async getSubHandleSettings(handleName: string): Promise<{ settings?: string; utxo: IUTxO } | null> {
        const handle = this.get(handleName);
        if (!handle || !handle.utxo) {
            throw new HttpException(404, 'Not found');
        }

        const { subhandle_settings } = handle;
        return subhandle_settings ?? null;
    }

    public async getSubHandles(handleName: string): Promise<StoredHandle[]> {
        const subHandles = this._getRootHandleSubHandles(handleName);
        return [...subHandles].reduce<StoredHandle[]>((agg, item) => {
            const subHandle = this.get(item);
            if (subHandle) {
                agg.push(subHandle);
            }
            return agg;
        }, []);
    }

    public getHandleStats(): IHandleStats {
        return this.getMetrics();
    }

    public getTotalHandlesStats(): { total_handles: number; total_holders: number } {
        return {
            total_handles: this.count(),
            total_holders: HandleStore.holderAddressIndex.size
        };
    }

    public currentHttpStatus(): number {
        return this.isCaughtUp() ? 200 : 202;
    }

    private setHolderAddressIndex(holderAddressDetails: AddressDetails, handleName?: string, isDefault?: boolean, oldHolderAddress?: string) {
        const { address: holderAddress, knownOwnerName, type } = holderAddressDetails;

        const holder = HandleStore.holderAddressIndex.get(holderAddress) ?? {
            handles: new Set(),
            defaultHandle: '',
            manuallySet: false,
            type,
            knownOwnerName
        };

        const getHandlesFromNames = (holder: HolderAddressIndex) => {
            const handles: StoredHandle[] = [];
            holder.handles.forEach((h: string) => {
                const handle = HandleStore.handles.get(h);
                if (handle) handles.push(handle);
                else holder.handles.delete(h);
            });
            return handles;
        };

        if (oldHolderAddress && handleName) {
            const oldHolder = HandleStore.holderAddressIndex.get(oldHolderAddress);
            if (oldHolder) {
                oldHolder.handles.delete(handleName);
                oldHolder.manuallySet = holder.manuallySet && oldHolder.defaultHandle != handleName;
                oldHolder.defaultHandle = oldHolder.manuallySet ? oldHolder.defaultHandle : getDefaultHandle(getHandlesFromNames(oldHolder))?.name ?? '';
            }
        }

        // add the new name if provided and does not already exist
        if (handleName && !holder.handles.has(handleName)) {
            holder.handles.add(handleName);
        }

        // if by this point, we have no handles, we need to remove the holder address from the index
        if (holder.handles.size === 0) {
            HandleStore.holderAddressIndex.delete(holderAddress);
            return;
        }
        // Set manuallySet to the incoming Handle if isDefault. If the incoming handleName is the same as the
        // current holder default, then we might be turning it off (unsetting it as default)
        holder.manuallySet = !!isDefault || (holder.manuallySet && holder.defaultHandle != handleName);

        // get the default handle or use the defaultName provided (this is used during personalization)
        // Set defaultHandle to incoming if isDefault, otherwise if manuallySet, then keep the current
        // default. If neither, then run getDefaultHandle algo
        holder.defaultHandle = !!isDefault && !!handleName ? handleName : holder.manuallySet ? holder.defaultHandle : getDefaultHandle(getHandlesFromNames(holder))?.name ?? '';

        HandleStore.holderAddressIndex.set(holderAddress, holder);
    }

    private async _buildHandle({ hex, name, adaAddress, og_number, image, slotNumber, utxo, lovelace, datum, script, amount = 1, bg_image = '', pfp_image = '', svg_version = '', version = 0, image_hash = '', handle_type = HandleType.HANDLE, resolved_addresses, personalization, reference_token, last_update_address, sub_characters, sub_length, sub_numeric_modifiers, sub_rarity, virtual, original_address, id_hash, pz_enabled, last_edited_time }: SaveMintingTxInput): Promise<StoredHandle> {
        const newHandle: StoredHandle = {
            name,
            hex,
            holder: '', // Populate on save
            holder_type: '', // Populate on save
            length: name.length,
            utxo,
            lovelace,
            rarity: getRarity(name),
            characters: buildCharacters(name),
            numeric_modifiers: buildNumericModifiers(name),
            resolved_addresses: {
                ...resolved_addresses,
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
            last_update_address,
            datum: isDatumEndpointEnabled() && datum ? datum : undefined,
            script,
            personalization,
            reference_token,
            amount,
            svg_version,
            version,
            handle_type,
            sub_characters,
            sub_length,
            sub_numeric_modifiers,
            sub_rarity,
            virtual,
            original_address,
            id_hash,
            pz_enabled,
            payment_key_hash: (await getPaymentKeyHash(adaAddress))!,
            last_edited_time
        };

        return newHandle;
    }

    private _buildHandleHistory(newHandle: Partial<StoredHandle>, oldHandle?: Partial<StoredHandle>): HandleHistory | null {
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
            agg[key] = oldHandle[key as keyof StoredHandle];
            return agg;
        }, {});

        // Only save old details if the network is production.
        // Otherwise, save the new for testing purposes
        return NETWORK === 'production' ? { old } : { old, new: difference };
    }

    private _saveSlotHistory({ handleHistory, handleName, slotNumber, maxSlots = this.twelveHourSlot }: { handleHistory: HandleHistory; handleName: string; slotNumber: number; maxSlots?: number }) {
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

    public async saveMintedHandle(input: SaveMintingTxInput) {
        const existingHandle = this.get(input.name);
        if (existingHandle) {
            // check if existing handle has a utxo. If it does, we may have a double mint
            if (existingHandle.utxo) {
                const updatedHandle = { ...existingHandle, amount: existingHandle.amount + 1 };
                await this._save({ handle: updatedHandle, oldHandle: existingHandle });
                return;
            }

            // if there is no utxo, it means we already received a 100 token.
            const inputWithExistingHandle: SaveMintingTxInput = {
                ...input,
                image: existingHandle.image,
                og_number: existingHandle.og_number,
                version: existingHandle.version,
                personalization: existingHandle.personalization,
                last_update_address: existingHandle.last_update_address,
                pz_enabled: existingHandle.pz_enabled,
                last_edited_time: existingHandle.last_edited_time,
                id_hash: existingHandle.id_hash
            };
            const builtHandle = await this._buildHandle(inputWithExistingHandle);
            await this._save({ handle: builtHandle, oldHandle: existingHandle });
            return;
        }

        const newHandle = await this._buildHandle(input);
        await this._save({ handle: newHandle });
    }

    public async saveHandleUpdate({ name, adaAddress, utxo, slotNumber, datum, script }: SaveWalletAddressMoveInput) {
        const existingHandle = this.get(name);
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
            resolved_addresses: { ...existingHandle.resolved_addresses, ada: adaAddress },
            updated_slot_number: slotNumber,
            has_datum: !!datum,
            datum: isDatumEndpointEnabled() && datum ? datum : undefined,
            script
        };

        await this._save({
            handle: updatedHandle,
            oldHandle: existingHandle
        });
    }

    public async savePersonalizationChange({ name, hex, personalization, reference_token, personalizationDatum, slotNumber, metadata }: SavePersonalizationInput) {
        const image = metadata?.image ?? '';
        const version = metadata?.version ?? 0;
        const og_number = metadata?.og_number ?? 0;
        const isTestnet = NETWORK.toLowerCase() !== 'mainnet';
        const isVirtualSubHandle = hex.startsWith(AssetNameLabel.LBL_000);
        const handleType = isVirtualSubHandle ? HandleType.VIRTUAL_SUBHANDLE : name.includes('@') ? HandleType.NFT_SUBHANDLE : HandleType.HANDLE;

        const virtual = personalizationDatum?.virtual ? { expires_time: personalizationDatum.virtual.expires_time, public_mint: !!personalizationDatum.virtual.public_mint } : undefined;

        // update resolved addresses
        // remove ada from the new addresses. The contract should not allow adding an incorrect address
        // but to be safe, we'll remove the ada address from the resolved addresses
        const addresses = personalizationDatum?.resolved_addresses
            ? Object.entries(personalizationDatum?.resolved_addresses ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
                if (key !== 'ada') {
                    acc[key] = value as string;
                }
                return acc;
            }, {})
            : {};

        const existingHandle = this.get(name);
        if (!existingHandle) {
            const buildHandleInput: SaveMintingTxInput = {
                name,
                hex,
                slotNumber,
                adaAddress: isVirtualSubHandle && personalizationDatum?.resolved_addresses?.ada ? bech32FromHex(personalizationDatum.resolved_addresses.ada.replace('0x', ''), isTestnet) : '', // address will come from the 222 token
                utxo: isVirtualSubHandle ? `${reference_token.tx_id}#${reference_token.index}` : '', // utxo will come from the 222 token,
                og_number,
                image,
                image_hash: personalizationDatum?.image_hash,
                personalization,
                reference_token,
                resolved_addresses: addresses,
                svg_version: personalizationDatum?.svg_version,
                version,
                handle_type: handleType,
                sub_rarity: metadata?.sub_rarity,
                sub_length: metadata?.sub_length,
                sub_characters: metadata?.sub_characters,
                sub_numeric_modifiers: metadata?.sub_numeric_modifiers,
                virtual,
                last_update_address: personalizationDatum?.last_update_address,
                original_address: personalizationDatum?.original_address,
                id_hash: personalizationDatum?.id_hash,
                lovelace: 0,
                pz_enabled: personalizationDatum?.pz_enabled ?? false,
                last_edited_time: personalizationDatum?.last_edited_time
            };
            const handle = await this._buildHandle(buildHandleInput);
            await this._save({ handle });
            return;
        }

        // If asset is a 000 token, we need to use the address from the personalization datum. Otherwise use existing address
        const adaAddress = isVirtualSubHandle && personalizationDatum?.resolved_addresses?.ada ? bech32FromHex(personalizationDatum.resolved_addresses.ada.replace('0x', ''), isTestnet) : existingHandle.resolved_addresses.ada;

        const updatedHandle: StoredHandle = {
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
                ...addresses,
                ada: adaAddress
            },
            personalization,
            reference_token,
            svg_version: personalizationDatum?.svg_version ?? '',
            default: personalizationDatum?.default ?? false,
            last_update_address: personalizationDatum?.last_update_address,
            virtual,
            original_address: personalizationDatum?.original_address,
            id_hash: personalizationDatum?.id_hash,
            pz_enabled: personalizationDatum?.pz_enabled ?? false,
            last_edited_time: personalizationDatum?.last_edited_time,
            payment_key_hash: (await getPaymentKeyHash(adaAddress))!,
            // set the utxo to incoming reference_token for virtual subhandles
            ...(isVirtualSubHandle ? { utxo: `${reference_token.tx_id}#${reference_token.index}` } : {})
        };

        await this._save({
            handle: updatedHandle,
            oldHandle: existingHandle
        });
    }

    public async saveSubHandleSettingsChange({ name, settingsDatum, utxoDetails, slotNumber }: SaveSubHandleSettingsInput) {
        const existingHandle = this.get(name);
        if (!existingHandle) {
            // There should always be an existing root handle for a subhandle
            const message = `Cannot save subhandle settings for ${name} because root handle does not exist`;
            Logger.log({
                message,
                event: 'this.saveSubHandleSettingsChange',
                category: LogCategory.NOTIFY
            });

            throw new Error(message);  
        }

        const updatedHandle: StoredHandle = {
            ...existingHandle,
            subhandle_settings: {
                settings: settingsDatum,
                utxo: utxoDetails
            },
            updated_slot_number: slotNumber
        };

        await this._save({
            handle: updatedHandle,
            oldHandle: existingHandle
        });
    }

    public async burnHandle(handleName: string, slotNumber: number){
        const existingHandle = this.get(handleName);
        if (!existingHandle) {
            Logger.log({
                message: `Cannot burn ${handleName} because Handle does not exist`,
                event: 'this.burnHandle',
                category: LogCategory.ERROR
            });

            return;
        }

        const burnAmount = existingHandle.amount - 1;

        if (burnAmount === 0) {
            await this._remove(handleName);
            const history: HandleHistory = { old: existingHandle, new: null };
            this._saveSlotHistory({
                handleHistory: history,
                handleName,
                slotNumber
            });
        } else {
            const updatedHandle = { ...existingHandle, amount: burnAmount };
            await this._save({ handle: updatedHandle, oldHandle: existingHandle });
        }
    }

    private convertMapsToObjects<T>(mapInstance: Map<string, T>) {
        return Array.from(mapInstance).reduce<Record<string, T>>((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
    }

    private memorySize() {
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

    public setMetrics(metrics: IHandleStoreMetrics): void {
        this.metrics = { ...this.metrics, ...metrics };
    }

    public getTimeMetrics() {
        const { elapsedOgmiosExec = 0, elapsedBuildingExec = 0 } = this.metrics;
        return {
            elapsedOgmiosExec,
            elapsedBuildingExec
        };
    }

    public isCaughtUp(): boolean {
        const { lastSlot = 1, currentSlot = 0, currentBlockHash = '0', tipBlockHash = '1' } = this.metrics;
        //console.log('lastSlot', lastSlot, 'currentSlot', currentSlot, 'currentBlockHash', currentBlockHash, 'tipBlockHash', tipBlockHash);
        return lastSlot - currentSlot < 120 && currentBlockHash == tipBlockHash;
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

    public async prepareHandlesStorage(loadS3 = true): Promise<{ slot: number; hash: string; } | null> {
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
            history: [number, ISlotHistoryIndex][];
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
            await this._save({ handle: newHandle, saveHistory: false });
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

    private async _remove (handleName: string) {
        const handle = HandleStore.handles.get(handleName);
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
        HandleStore.handles.delete(handleName);

        const ogFlag = og_number === 0 ? 0 : 1;

        // set all one-to-many indexes
        HandleStore.rarityIndex.get(rarity)?.delete(handleName);
        HandleStore.ogIndex.get(`${ogFlag}`)?.delete(handleName);
        HandleStore.charactersIndex.get(characters)?.delete(handleName);
        const payment_key_hash = (await getPaymentKeyHash(ada))!;
        HandleStore.paymentKeyHashesIndex.get(payment_key_hash)?.delete(handleName);
        HandleStore.addressesIndex.get(ada)?.delete(handleName);
        HandleStore.numericModifiersIndex.get(numeric_modifiers)?.delete(handleName);
        HandleStore.lengthIndex.get(`${length}`)?.delete(handleName);

        // delete from subhandles index
        if (handleName.includes('@')) {
            const rootHandle = handleName.split('@')[1];
            HandleStore.subHandlesIndex.get(rootHandle)?.delete(handleName);
        }

        // remove the stake key index
        HandleStore.holderAddressIndex.get(holder)?.handles.delete(handleName);
        this.setHolderAddressIndex(getAddressHolderDetails(ada));
    }

    private eraseStorage() {
        // erase all indexes
        HandleStore.handles = new Map<string, StoredHandle>();
        HandleStore.holderAddressIndex = new Map<string, HolderAddressIndex>();
        HandleStore.rarityIndex = new Map<string, Set<string>>();
        HandleStore.ogIndex = new Map<string, Set<string>>();
        HandleStore.subHandlesIndex = new Map<string, Set<string>>();
        HandleStore.charactersIndex = new Map<string, Set<string>>();
        HandleStore.paymentKeyHashesIndex = new Map<string, Set<string>>();
        HandleStore.addressesIndex = new Map<string, Set<string>>();
        HandleStore.numericModifiersIndex = new Map<string, Set<string>>();
        HandleStore.lengthIndex = new Map<string, Set<string>>();
    }

    public async rollBackToGenesis() {
        Logger.log({
            message: 'Rolling back to genesis',
            category: LogCategory.INFO,
            event: 'this.rollBackToGenesis'
        });

        // erase all indexes
        this.eraseStorage();

        // clear storage files
        await this.saveFileContents({ storagePath: this.storageFilePath });
    }

    public async rewindChangesToSlot({ slot, hash, lastSlot }: { slot: number; hash: string; lastSlot: number }): Promise<{ name: string; action: string; handle: Partial<StoredHandle> | undefined }[]> {
        // first we need to order the historyIndex desc by slot
        const orderedHistoryIndex = [...HandleStore.slotHistoryIndex.entries()].sort((a, b) => b[0] - a[0]);
        let handleUpdates = 0;
        let handleDeletes = 0;
        const rewoundHandles = [];

        // iterate through history starting with the most recent up to the slot we want to rewind to.
        for (const item of orderedHistoryIndex) {
            const [slotKey, history] = item;

            // once we reach the slot we want to rewind to, we can stop
            if (slotKey <= slot) {
                Logger.log({
                    message: `Finished Rewinding to slot ${slot} with ${handleUpdates} updates and ${handleDeletes} deletes.`,
                    category: LogCategory.INFO,
                    event: 'rewindChangesToSlot'
                });

                // Set metrics to get the correct slot saving and percentage if there are no new blocks
                this.setMetrics({ currentSlot: slot, currentBlockHash: hash, lastSlot });
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
                        rewoundHandles.push({ name, action: 'create', handle: handleHistory.old });
                        await this._save({ handle: handleHistory.old as StoredHandle, saveHistory: false });
                        handleUpdates++;
                        continue;
                    }

                    Logger.log(`Handle ${name} does not exist`);
                    continue;
                }

                if (handleHistory.old === null) {
                    // if the old value is null, then the handle was deleted
                    // so we need to remove it from the indexes
                    rewoundHandles.push({ name, action: 'delete', handle: undefined });
                    await this._remove(name);
                    handleDeletes++;
                    continue;
                }

                // otherwise we need to update the handle with the old values
                const updatedHandle: StoredHandle = {
                    ...existingHandle,
                    ...handleHistory.old
                };

                rewoundHandles.push({ name, action: 'update', handle: updatedHandle });
                await this._save({ handle: updatedHandle, oldHandle: existingHandle, saveHistory: false });
                handleUpdates++;
            }

            // delete the slot key since we are rolling back to it
            HandleStore.slotHistoryIndex.delete(slotKey);
        }
        return rewoundHandles;
    }

    // Used for unit testing
    Internal = {
        buildHandleHistory: this._buildHandleHistory.bind(this),
        buildHandle: this._buildHandle.bind(this),
        save: this._save.bind(this),
        remove: this._remove.bind(this),
        saveSlotHistory: this._saveSlotHistory.bind(this),
        saveHandlesFile: this._saveHandlesFile.bind(this),
        getFile: this._getFile.bind(this),
        getRootHandleSubHandles: this._getRootHandleSubHandles.bind(this),
        storageSchemaVersion: this._storageSchemaVersion
    }
}
