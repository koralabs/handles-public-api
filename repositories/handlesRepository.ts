import { Point } from '@cardano-ogmios/schema';
import { AssetNameLabel, bech32FromHex, buildCharacters, buildDrep, buildHolderInfo, buildNumericModifiers, decodeAddress, decodeCborToJson, DefaultHandleInfo, diff, EMPTY, getPaymentKeyHash, getRarity, HandleHistory, HandlePaginationModel, HandleSearchModel, HandleType, Holder, HolderPaginationModel, HolderViewModel, HttpException, IApiMetrics, IApiStore, IHandleMetadata, IndexNames, IPersonalization, IPzDatum, IPzDatumConvertedUsingSchema, ISlotHistory, ISubHandleSettings, ISubHandleTypeSettings, IUTxO, LogCategory, Logger, MINTED_OG_LIST, NETWORK, StoredHandle, TWELVE_HOURS_IN_SLOTS } from '@koralabs/kora-labs-common';
import { designerSchema, handleDatumSchema, portalSchema, socialsSchema, subHandleSettingsDatumSchema } from '@koralabs/kora-labs-common/utils/cbor';
import * as crypto from 'crypto';
import { isDatumEndpointEnabled } from '../config';
import { BuildPersonalizationInput, ScannedHandleInfo } from '../interfaces/ogmios.interfaces';
import { getHandleNameFromAssetName } from '../services/ogmios/utils';
import { decodeCborFromIPFSFile } from '../utils/ipfs';
import { sortAlphabetically, sortByCreatedSlotNumber, sortedByLength, sortOGHandle } from './tests';
const blackListedIpfsCids: string[] = [];
const isTestnet = NETWORK.toLowerCase() !== 'mainnet';

/********** RewoundHandle IS USED TO FLAG THE HANDLE TO AVOID SAVING SLOT HISTORY ********************/
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface RewoundHandle extends StoredHandle {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class RewoundHandle implements RewoundHandle {
    constructor(handle: StoredHandle) {
        Object.assign(this, handle);
    }
}

/********** UpdatedOwnerHandle IS USED TO FLAG THE HANDLE FOR HOLDER LOGIC ***************************/
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface UpdatedOwnerHandle extends StoredHandle {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class UpdatedOwnerHandle implements UpdatedOwnerHandle {
    constructor(handle: StoredHandle) {
        Object.assign(this, handle);
    }
}

export class HandlesRepository {
    private store: IApiStore;
    
    constructor(store: IApiStore) {
        this.store = store;
    }

    public async initialize() {
        await this.store.initialize();
        return this;
    }

    public destroy(): void {
        return this.store.destroy();
    }

    public currentHttpStatus(): number {
        return this.isCaughtUp() ? 200 : 202        
    }

    public isCaughtUp(): boolean {
        const { lastSlot = 1, currentSlot = 0, currentBlockHash = '0', tipBlockHash = '1' } = this.store.getMetrics();
        return lastSlot - currentSlot < 120 && currentBlockHash == tipBlockHash;
    }
    
    public getHandle(key: string): StoredHandle | null {
        const handle = structuredClone(this.store.getValueFromIndex(IndexNames.HANDLE, key));
        if (!handle) return null;
        return this.prepareHandle(handle as StoredHandle);
    }

    public getHandleByHex(hex: string): StoredHandle | null {
        const {name} = getHandleNameFromAssetName(hex);
        const handle = this.getHandle(name);
        if(handle?.hex != hex) return null;
        return handle;
    }

    private prepareHandle(handle?: StoredHandle | null) {
        if (!handle) {
            return null;
        }

        // Attach the default Handle
        const holder = this.store.getValueFromIndex(IndexNames.HOLDER, handle.holder) as Holder | undefined;
        if (holder) {
            handle.default_in_wallet = `${holder.defaultHandle}`; // Converts numeric handles to a string
        }

        // Workaround for numeric handles names
        handle.name = `${handle.name}`
        handle.hex = `${handle.hex}`

        return handle;
    }

    public getHolder(address: string): Holder {
        return this.store.getValueFromIndex(IndexNames.HOLDER, address) as Holder;
    }

    private _shuffle(t: any[])
    { 
        let last = t.length
        let n
        while (last > 0)
        { 
            n = 0 | Math.random() * last;
            let q = t[n]
            let j = --last;
            t[n] = t[j]
            t[j] = q
        }
    }

    public search(pagination?: HandlePaginationModel, searchModel?: HandleSearchModel, namesOnly = false): { searchTotal: number, handles: (StoredHandle | string)[] } {
        let handles: StoredHandle[] = [];
        // The ['|empty|'] is important for `AND` searches here and indicates 
        // that we couldn't find any results for one of the search terms
        // When intersected with all other results, ['|empty|'] ensures empty result set
        // while [] means the term wasn't searched so return them all
        const checkEmptyResult = (indexName: IndexNames, term: string | number | undefined) => {
            if (!term) return [];
            const set = this.store.getValuesFromIndexedSet(indexName, term) ?? new Set<string>();
            return set.size === 0 ? [EMPTY] : [...set];
        };

        // get handle name arrays for all the search parameters
        const characterArray = checkEmptyResult(IndexNames.CHARACTER, searchModel?.characters);
        let lengthArray: string[] = [];
        if (searchModel?.length?.includes('-')) {
            for (let i = parseInt(searchModel?.length.split('-')[0]); i <= parseInt(searchModel?.length.split('-')[1]); i++) {
                lengthArray = lengthArray.concat([...this.store.getValuesFromIndexedSet(IndexNames.LENGTH, i) ?? new Set<string>()]);
            }
            if (lengthArray.length === 0) lengthArray = [EMPTY];
        } else {
            lengthArray = checkEmptyResult(IndexNames.LENGTH, parseInt(searchModel?.length || '0'));
        }
        const pzArray = searchModel?.personalized ? checkEmptyResult(IndexNames.PERSONALIZED, 1) : [];
        const typeArray = checkEmptyResult(IndexNames.HANDLE_TYPE, searchModel?.handle_type);
        const rarityArray = checkEmptyResult(IndexNames.RARITY, searchModel?.rarity);
        const numericModifiersArray = checkEmptyResult(IndexNames.NUMERIC_MODIFIER, searchModel?.numeric_modifiers);
        const ogArray = searchModel?.og ? checkEmptyResult(IndexNames.OG, 1) : [];
        const holderArray = (() => {
            if (!searchModel?.holder_address) return [];
            const holder = this.store.getValueFromIndex(IndexNames.HOLDER, searchModel?.holder_address) as Holder;
            return holder ? [...holder.handles.map(h => h.name)] : [EMPTY];
        })();

        let handleNames:string[] | undefined = undefined;
        
        // filter out any empty arrays
        const filtered = [characterArray, lengthArray, typeArray, rarityArray, numericModifiersArray, holderArray, ogArray, pzArray].filter((a) => a?.length)
        if (filtered.length == 0) {
            // This means request had no filtered terms, so we need to start with the whole set
            handleNames = Array.from(this.store.getKeysFromIndex(IndexNames.HANDLE)).map((handle) => handle as string);
        }
        else {
            // Get the intersection
            handleNames = [...new Set(filtered.reduce((a, b) => a.filter((c: string) => b.includes(c))))]
                // if there is an EMPTY here, there are no results
                .filter((name) => name !== EMPTY);
        }
        const checkSearch = (name: string, search?: string) => {
            if (!search) return true;
            if (name.includes(search)) return true;

            const hex = Buffer.from(name, 'utf8').toString('hex');
            if (`${AssetNameLabel.LBL_222}${hex}`.includes(search)) return true;
            if (`${AssetNameLabel.LBL_000}${hex}`.includes(search)) return true;
            
            return false;
        }

        // Check for the searched term or handle list
        handleNames = handleNames.filter((name) => (!searchModel?.handles || searchModel?.handles.includes(name)) && checkSearch(name, searchModel?.search))
        const searchTotal = handleNames.length;

        if (namesOnly) {
            return { searchTotal, handles: handleNames ?? [] };
        }


        if (pagination?.slotNumber) {
            // Get all of the handleNames' slotNumbers
            // Sort by the slot numbers
            // 
        }
        else {
            const startIndex = ((pagination?.page ?? 1) - 1) * (pagination?.handlesPerPage ?? 100);
            handleNames = handleNames.slice(startIndex, startIndex + (pagination?.handlesPerPage ?? 100));
        }

        handles = (this.store.pipeline(() => {
            for (const h in handleNames) {
                this.store.getValueFromIndex(IndexNames.HANDLE, h)
            }
        }) as StoredHandle[]).map((h) => this.prepareHandle(structuredClone(h) as StoredHandle)!)
    
        switch (pagination?.sort) {
            case 'random':
                this._shuffle(handles);
                break;
            case 'desc': 
                handles.sort((h1, h2) => h2.name.localeCompare(h1.name));
                break;
            default:
                handles.sort((h1, h2) => h1.name.localeCompare(h2.name));
                break;
        }

        return { searchTotal, handles };
    }

    public getMetrics(): IApiMetrics {  
        return this.store.getMetrics();
    }

    public getHandlesByHolderAddresses = (addresses: string[]): string[]  => {
        return addresses.map((address) => {
            const array = Array.from((this.store.getValueFromIndex(IndexNames.HOLDER, address) as Holder)?.handles.map(h => h.name) ?? []);
            return array.length === 0 ? [EMPTY] : array;
        }
        ).concat(addresses.map((address) => { // convert holder addresses to hash and look in that index too
            const decodedAddress = decodeAddress(address);
            if (!decodedAddress) return [EMPTY];
            const hashed = crypto.createHash('md5').update(decodedAddress, 'hex').digest('hex');
            const array: string[] = Array.from(this.store.getValuesFromIndexedSet(IndexNames.HASH_OF_STAKE_KEY_HASH, hashed!) ?? new Set());
            return array.length === 0 ? [EMPTY] : array;
        })).flat() as string[];
    }

    public getAllHolders(params: { pagination: HolderPaginationModel; }): HolderViewModel[] {
        const { page, sort, recordsPerPage } = params.pagination;
        const items: HolderViewModel[] = [];
        (this.store.getIndex(IndexNames.HOLDER) as Map<string, Holder>).forEach((holder, key) => {
            if (holder) {
                const { handles, defaultHandle, manuallySet, type, knownOwnerName } = holder;
                items.push({
                    total_handles: handles?.length ?? 0,
                    default_handle: defaultHandle,
                    manually_set: manuallySet,
                    address: key,
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

    public getHandlesByStakeKeyHashes = (hashes: string[]): string[]  => {
        return hashes.map((h) => {
            const hashed = crypto.createHash('md5').update(h, 'hex').digest('hex');
            const array = Array.from(this.store.getValuesFromIndexedSet(IndexNames.HASH_OF_STAKE_KEY_HASH, hashed!) ?? []);
            return array.length === 0 ? [EMPTY] : array;
        }).flat() as string[];
    }

    public getHandlesByPaymentKeyHashes = (hashes: string[]): string[]  => {
        return hashes.map((h) => {
            const array = Array.from(this.store.getValuesFromIndexedSet(IndexNames.PAYMENT_KEY_HASH, h) ?? []);
            return array.length === 0 ? [EMPTY] : array;
        }
        ).flat() as string[];
    }

    public getHandlesByAddresses = (addresses: string[]): string[] => {
        return addresses.map((h) => {
            const array = Array.from(this.store.getValuesFromIndexedSet(IndexNames.ADDRESS, h) ?? []);
            return array.length === 0 ? [EMPTY] : array;
        }
        ).flat() as string[];
    }

    public getHandleDatumByName(handleName: string): string | null {
        const handle = this.getHandle(handleName);
        if (!handle || !handle.utxo) {
            throw new HttpException(404, 'Not found');
        }

        const { has_datum, datum = null } = handle;
        if (!has_datum) return null;
        return datum;
    }

    public getSubHandleSettings(handleName: string): { settings?: string; utxo: IUTxO } | null {
        const handle = this.getHandle(handleName);
        if (!handle || !handle.utxo) {
            throw new HttpException(404, 'Not found');
        }

        const { subhandle_settings } = handle;
        return subhandle_settings ?? null;
    }

    public getSubHandlesByRootHandle(handleName: string): StoredHandle[] {
        const subHandles = this.store.getValuesFromIndexedSet(IndexNames.SUBHANDLE, handleName) ?? new Set<string>();
        return [...subHandles].reduce<StoredHandle[]>((agg, item) => {
            const subHandle = this.getHandle(item);
            if (subHandle) {
                agg.push(subHandle);
            }
            return agg;
        }, []);
    }

    public getRootHandleNames(): string[] {
        // We expect at least one SubHandle to be minted to be counted as a rootHandle (have an entry in SUBHANDLE index)
        return this.store.getKeysFromIndex(IndexNames.SUBHANDLE) as string[];
    }

    public setMetrics(metrics: Partial<IApiMetrics>): void {
        this.store.setMetrics(metrics);
    }

    public updateHolder(handle?: StoredHandle | UpdatedOwnerHandle, oldHandle?: StoredHandle) {
        let newDefault: boolean | undefined = undefined;
        let oldDefault: boolean | undefined = undefined;
        if (oldHandle) {
            const oldHolderInfo = buildHolderInfo(oldHandle.resolved_addresses.ada);
            const oldHolder = this.store.getValueFromIndex(IndexNames.HOLDER, oldHolderInfo.address) as Holder
            if (oldHolder) {
                oldDefault = oldHolder.manuallySet && oldHolder.defaultHandle == oldHandle.name;
                const oldIndex = oldHolder.handles?.findIndex(h => h.name == oldHandle.name) ?? -1;
                if (oldIndex > -1) {
                    oldHolder.handles.splice(oldIndex, 1);
                }
                
                this.store.pipeline(() => {
                    if (Object.keys(oldHolder.handles).length === 0) {
                        this.store.removeKeyFromIndex(IndexNames.HOLDER, oldHolderInfo.address);
                    } else {
                        oldHolder.manuallySet = oldHolder.manuallySet && oldHolder.defaultHandle != oldHandle.name;
                        oldHolder.defaultHandle = oldHolder.manuallySet ? oldHolder.defaultHandle : this.getDefaultHandle(oldHolder.handles)?.name ?? '';
                        this.store.setValueOnIndex(IndexNames.HOLDER, oldHolderInfo.address, oldHolder);
                    }
                });
            }
        }

        if (!handle) return {newDefault, oldDefault};

        const holderInfo = buildHolderInfo(handle.resolved_addresses.ada);
        const { address, knownOwnerName, type } = holderInfo;

        const holder = (this.store.getValueFromIndex(IndexNames.HOLDER, address) ?? {
            handles: [],
            defaultHandle: '',
            manuallySet: false,
            type,
            knownOwnerName
        }) as Holder;

        const holderHandle = {name: handle.name, created_slot_number: handle.created_slot_number, og_number: handle.og_number};
        // add the new name if provided and does not already exist
        if (!holder.handles.some(h => h.name == handle.name)) {
            holder.handles.push(holderHandle);
        }

        // if by this point, we have no handles, we need to remove the holder address from the index
        if (holder.handles.length === 0) {
            this.store.removeKeyFromIndex(IndexNames.HOLDER, address);
            return {newDefault, oldDefault};
        }

        const wasPreviouslyManuallySetToDefault = holder.manuallySet && holder.defaultHandle == handle.name;
        if (!(handle instanceof UpdatedOwnerHandle)) {    
            // handle.default can only be set when it is the Reference Token (or virtual), not UpdatedOwnerHandle
            
            // Set manuallySet to the incoming Handle if isDefault. If the incoming handleName is the same as the
            // current holder default, then we are turning it off (unsetting it as default)
            if (handle.default) {
                holder.manuallySet = true;
            }
            else {
                if (wasPreviouslyManuallySetToDefault) {
                    holder.manuallySet = false;
                }                
            }
        }
        else {
            // set it to true if it is the current manually set handle for the holder
            handle.default = wasPreviouslyManuallySetToDefault;
        }

        if (handle.default) {
            holder.manuallySet = true;
        }
        else {
            if (wasPreviouslyManuallySetToDefault) {
                holder.manuallySet = false; // This might not be true if this came from a tx that was an owner token
            }                
        }

        // get the default handle or use the defaultName provided (this is used during personalization)
        // Set defaultHandle to incoming if isDefault, otherwise if manuallySet, then keep the current
        // default. If neither, then run this.getDefaultHandle algo
        holder.defaultHandle = (() => {
            if (handle.default) {return handle.name}
            else {
                if (holder.manuallySet) return holder.defaultHandle; 
                else return this.getDefaultHandle([holderHandle, ...holder.handles])?.name ?? ''}
        })();

        handle.holder = address;
        handle.holder_type = holder.type;
        newDefault = handle.default;
        delete handle.default; // This is a temp property not meant to save to the handle

        this.store.setValueOnIndex(IndexNames.HOLDER, address, holder);
        
        if (address && address != '') {
            // This could return null if it is a pre-Shelley address (not bech32)
            const decodedAddress = decodeAddress(address);
            const oldDecodedAddress = decodeAddress(`${oldHandle?.holder}`);
            if (decodedAddress == oldDecodedAddress) {
                return {newDefault, oldDefault};
            }
            if (decodedAddress) {
                this.store.pipeline(() => {
                    if (oldDecodedAddress) {
                        // if there is an old stake key hash, remove it from the index
                        const oldHashOfStakeKeyHash = crypto.createHash('md5').update(oldDecodedAddress, 'hex').digest('hex')
                        this.store.removeValueFromIndexedSet(IndexNames.HASH_OF_STAKE_KEY_HASH, oldHashOfStakeKeyHash, handle.name);     
                    }
                    const hashOfStakeKeyHash = handle.id_hash ? handle.id_hash.replace('0x', '').slice(34) : crypto.createHash('md5').update(decodedAddress, 'hex').digest('hex')
                    this.store.addValueToIndexedSet(IndexNames.HASH_OF_STAKE_KEY_HASH, hashOfStakeKeyHash, handle.name);
                });
            }
        }
        return {newDefault, oldDefault};
    }

    public rollBackToGenesis(): void {
        this.store.rollBackToGenesis();
    }

    public removeHandle(handle: StoredHandle | RewoundHandle, slotNumber: number): void {
        const handleName = handle.name;
        const amount = handle.amount - 1;
        
        if (amount <= 0) {
            // if (handle.name == 'ap@adaprotocol')
            //     debugLog('ap@adaprotocol being burned', slotNumber, handle);
            this.store.removeKeyFromIndex(IndexNames.HANDLE, handle.name);
            if (!(handle instanceof RewoundHandle)) {
                const history: HandleHistory = { old: handle, new: null };
                this._saveSlotHistory({
                    handleHistory: history,
                    handleName,
                    slotNumber
                });
            }

            // set all one-to-many indexes
            this.store.removeValueFromIndexedSet(IndexNames.RARITY, handle.rarity, handleName)
            this.store.removeValueFromIndexedSet(IndexNames.OG, Number(handle.og_number), handleName);
            this.store.removeValueFromIndexedSet(IndexNames.CHARACTER, handle.characters, handleName)
            const payment_key_hash = getPaymentKeyHash(handle.resolved_addresses.ada)!;
            this.store.removeValueFromIndexedSet(IndexNames.PAYMENT_KEY_HASH, payment_key_hash, handleName)
            this.store.removeValueFromIndexedSet(IndexNames.ADDRESS, handle.resolved_addresses.ada, handleName)
            this.store.removeValueFromIndexedSet(IndexNames.NUMERIC_MODIFIER, handle.numeric_modifiers, handleName)
            this.store.removeValueFromIndexedSet(IndexNames.LENGTH, handle.length, handleName)
    
            // delete from subhandles index
            if (handleName.includes('@')) {
                const rootHandle = handleName.split('@')[1];
                this.store.removeValueFromIndexedSet(IndexNames.SUBHANDLE, rootHandle, handleName);
            }
    
            // remove the stake key index
            this.updateHolder(undefined, handle);
            // if (handle.name == 'ap@adaprotocol')
            //     debugLog('ap@adaprotocol burned', slotNumber, this.store.getHandle(handle.name));
        } else {
            const updatedHandle = { ...handle, amount };
            this.save(updatedHandle, handle);
        }
    }

    public rewindChangesToSlot({ slot, hash, lastSlot }: { slot: number; hash: string; lastSlot: number }): { name: string; action: string; handle: Partial<StoredHandle> | undefined }[] {
        // first we need to order the historyIndex desc by slot
        const orderedHistoryIndex = [...this.store.getIndex(IndexNames.SLOT_HISTORY) as Map<number, ISlotHistory>].sort((a, b) => b[0] - a[0]);
        const rewoundHandles: { name: string, action: string, handle: Partial<StoredHandle> | undefined }[] = [];

        // iterate through history starting with the most recent up to the slot we want to rewind to.
        for (const item of orderedHistoryIndex) {
            const [slotKey, history] = item;

            // once we reach the slot we want to rewind to, we can stop
            if (slotKey <= slot) {
                // Set metrics to get the correct slot saving and percentage if there are no new blocks
                this.setMetrics({ currentSlot: slot, currentBlockHash: hash, lastSlot });
                break;
            }

            // iterate through each handle hex in the history and revert it to the previous state
            const keys = Object.keys(history);
            for (let i = 0; i < keys.length; i++) {
                const name = keys[i];
                const handleHistory = history[name] as HandleHistory;

                const existingHandle = this.getHandle(name);
                if (!existingHandle) {
                    if (handleHistory.old) {
                        rewoundHandles.push({ name, action: 'create', handle: handleHistory.old });
                        this.save(new RewoundHandle(handleHistory.old as StoredHandle));
                        continue;
                    }
                    continue;
                }

                if (handleHistory.old === null) {
                    // if the old value is null, then the handle was deleted
                    // so we need to remove it from the indexes
                    rewoundHandles.push({ name, action: 'delete', handle: undefined });
                    this.removeHandle(new RewoundHandle(existingHandle), this.getMetrics().currentSlot ?? 0);
                    continue;
                }

                // otherwise we need to update the handle with the old values
                const updatedHandle: StoredHandle = {
                    ...existingHandle,
                    ...(handleHistory as HandleHistory).old
                };

                rewoundHandles.push({ name, action: 'update', handle: updatedHandle });
                this.save(new RewoundHandle(updatedHandle), existingHandle);
            }

            // delete the slot key since we are rolling back to it
            this.store.removeKeyFromIndex(IndexNames.SLOT_HISTORY, slotKey);
        }
        return rewoundHandles;
    }
    
    public async processScannedHandleInfo(scannedHandleInfo: ScannedHandleInfo): Promise<void> {
        const {assetName, utxo, lovelace, datum, address, policy, slotNumber, script, metadata, isMintTx} = scannedHandleInfo
        const { handleHex, name, isCip67, assetLabel } = getHandleNameFromAssetName(assetName);
        const data = metadata && (metadata[isCip67 ? handleHex : name] as unknown as IHandleMetadata);
        const existingHandle = this.getHandle(name) ?? undefined;
        let handle = existingHandle ?? this._buildHandle({name, hex: handleHex, policy, resolved_addresses: {ada: address}, updated_slot_number: slotNumber}, data);
        
        if (typeof handle.name != 'string') {
            console.log('HANDLE', handle, existingHandle)
        }
        // if (['ap@adaprotocol', 'b-263-54'].some(n => n == handle.name))
        //     debugLog('PROCESSED SCANNED INFO START', slotNumber, {...handle, utxo})

        const [txId, indexString] = utxo.split('#');
        const index = parseInt(indexString);
        const utxoDetails = { tx_id: txId, index, lovelace, datum: datum ?? '', address };

        switch (assetLabel) {
            case null:
            case AssetNameLabel.NONE:
            case AssetNameLabel.LBL_222:
                if (!existingHandle && !isMintTx) {
                    Logger.log({ message: `Handle was updated but there is no existing handle in storage with name: ${name}`, category: LogCategory.INFO, event: 'saveHandleUpdate.noHandleFound' });
                }
                if (slotNumber < handle.updated_slot_number && isMintTx) {
                    handle.created_slot_number = Math.min(handle.created_slot_number, slotNumber, existingHandle?.created_slot_number ?? Number.POSITIVE_INFINITY);
                }
                if (slotNumber >= handle.updated_slot_number) {
                    // check if existing handle has a utxo. If it does, we may have a double mint
                    if (isMintTx && existingHandle?.utxo && existingHandle?.utxo != utxo) {
                        handle.amount = (handle.amount ?? 1) + 1;
                        if (handle.name != 'mydexaccounts') // The one double mint we had when half of Cardano nodes disconnected/restarted at 2023-01-22T00:09:00Z. Both the doublemint and what caused it on our side have been remedied
                            Logger.log({ message: `POSSIBLE DOUBLE MINT! Name: ${name} | Old UTxO ${existingHandle?.utxo} | Old Slot: ${existingHandle.created_slot_number} | New UTxO: ${utxo} | New Slot: ${slotNumber}`, category: LogCategory.NOTIFY, event: 'saveHandleUpdate.utxoAlreadyExists'});
                    }
                    handle.updated_slot_number = slotNumber;
                    handle.script = script;
                    handle.datum = isDatumEndpointEnabled() && datum ? datum : undefined;
                    handle.has_datum = !!datum;
                    handle.lovelace = lovelace;
                    handle.utxo = utxo;
                    handle.resolved_addresses!.ada = address;
                    handle = new UpdatedOwnerHandle(handle);
                }
                break;
            case AssetNameLabel.LBL_100:
            case AssetNameLabel.LBL_000:
            {
                if (slotNumber >= handle.updated_slot_number) {
                    if (!datum) {
                        Logger.log({ message: `No datum for reference token ${assetName}`, category: LogCategory.ERROR, event: 'processScannedHandleInfo.referenceToken.noDatum' });
                        return;
                    }

                    const { projectAttributes } = this._buildPersonalizationData(handle, datum); // <- handle is mutated

                    handle.updated_slot_number = slotNumber
                    handle.reference_token = utxoDetails
                    handle.resolved_addresses = {
                        ...projectAttributes?.resolved_addresses,
                        ada: existingHandle?.resolved_addresses?.ada ?? ''
                    }

                    // VIRTUAL_SUBHANDLE
                    if (assetLabel == AssetNameLabel.LBL_000) {
                        handle.virtual = projectAttributes?.virtual ? { expires_time: projectAttributes.virtual.expires_time, public_mint: !!projectAttributes.virtual.public_mint } : undefined
                        handle.utxo = `${utxoDetails.tx_id}#${utxoDetails.index}`;
                        handle.resolved_addresses!.ada = bech32FromHex(projectAttributes!.resolved_addresses!.ada.replace('0x', ''), isTestnet);
                        handle.handle_type = HandleType.VIRTUAL_SUBHANDLE;
                    }
                }
                break;
            }
            case AssetNameLabel.LBL_001:
                if (slotNumber >= handle.updated_slot_number) {
                    if (!existingHandle) {
                        // There should always be an existing root handle for a subhandle
                        Logger.log({ message: `Cannot save subhandle settings for ${name} because root handle does not exist`, event: 'this.saveSubHandleSettingsChange', category: LogCategory.NOTIFY });
                        return;  
                    }
            
                    if (!datum) {
                        Logger.log({ message: `No datum for SubHandle token ${scannedHandleInfo.assetName}`,  category: LogCategory.ERROR, event: 'processScannedHandleInfo.subHandle.noDatum'});
                        return;
                    }

                    handle.subhandle_settings = {
                        ...(this._parseSubHandleSettingsDatum(datum)),
                        utxo: utxoDetails
                    }
                    handle.updated_slot_number = slotNumber;
                    handle.resolved_addresses = {
                        ...existingHandle?.resolved_addresses,
                        ada: existingHandle?.resolved_addresses?.ada ?? ''
                    }
                }
                break;
            default:
                Logger.log({ message: `Unknown asset: ${assetName}`, category: LogCategory.ERROR, event: 'processScannedHandleInfo.unknownAssetName' });
        }
        
        this.save(handle, existingHandle);

        // if (['ap@adaprotocol', 'b-263-54'].some(n => n == handle.name))
        //     debugLog('PROCESSED SCANNED INFO END', slotNumber, handle)
    }

    public save(handle: StoredHandle | RewoundHandle | UpdatedOwnerHandle, oldHandle?: StoredHandle) {
        const {
            name,
            rarity,
            og_number,
            characters,
            numeric_modifiers,
            length,
            resolved_addresses: { ada },
            updated_slot_number
        } = handle;

        // if (['ap@adaprotocol', 'b-263-54'].some(n => n == handle.name))
        //     debugLog('SAVE CALLED FOR', handle.updated_slot_number, handle)

        const payment_key_hash = getPaymentKeyHash(ada)!;
        const old_payment_key_hash = getPaymentKeyHash(oldHandle?.resolved_addresses.ada!)!;
        const ogFlag = og_number > 0;
        handle.payment_key_hash = payment_key_hash;
        handle.drep = buildDrep(ada, handle.id_hash?.replace('0x', ''));

        const {newDefault, oldDefault} = this.updateHolder(handle, oldHandle);

        this.store.pipeline(() => {
            // Set the main index (SAVES THE HANDLE)
            this.store.setValueOnIndex(IndexNames.HANDLE, name, handle);

            // set all one-to-many indexes
            this.store.addValueToIndexedSet(IndexNames.RARITY, rarity, name);
            this.store.addValueToIndexedSet(IndexNames.CHARACTER, characters, name);
            this.store.addValueToIndexedSet(IndexNames.NUMERIC_MODIFIER, numeric_modifiers, name);
            this.store.addValueToIndexedSet(IndexNames.LENGTH, length, name);
            this.store.addValueToIndexedSet(IndexNames.HANDLE_TYPE, handle.handle_type, name);

            if (name.includes('@')) {
                const rootHandle = name.split('@')[1];
                this.store.addValueToIndexedSet(IndexNames.SUBHANDLE, rootHandle, name);
            }

            const personalized = (() => {
                if (handle.image_hash != handle.standard_image_hash) return true;
                const pz = handle.personalization;
                return !!pz?.designer || !!pz?.portal || !!pz?.socials
            })();

            // remove the old - these can change over time
            this.store.removeValueFromIndexedSet(IndexNames.OG, Number(!ogFlag), name);
            this.store.removeValueFromIndexedSet(IndexNames.PERSONALIZED, Number(!personalized), name);
            this.store.removeValueFromIndexedSet(IndexNames.ADDRESS, oldHandle?.resolved_addresses.ada!, name); 
            this.store.removeValueFromIndexedSet(IndexNames.PAYMENT_KEY_HASH, old_payment_key_hash, name);
            this.store.removeKeyFromIndex(IndexNames.SLOT, updated_slot_number);
            
            // add the new
            this.store.addValueToIndexedSet(IndexNames.PERSONALIZED, Number(personalized), name);
            this.store.addValueToIndexedSet(IndexNames.OG, Number(ogFlag), name);
            this.store.addValueToIndexedSet(IndexNames.ADDRESS, ada, name);
            this.store.addValueToIndexedSet(IndexNames.PAYMENT_KEY_HASH, payment_key_hash, name);
            this.store.setValueOnIndex(IndexNames.SLOT, updated_slot_number, name);

            if (!(handle instanceof RewoundHandle)) {
                const history = this._buildHandleHistory({...handle, default: newDefault}, oldHandle ? {...oldHandle, default: oldDefault || undefined} : undefined);
                if (history)
                    this._saveSlotHistory({
                        handleHistory: history,
                        handleName: name,
                        slotNumber: updated_slot_number
                    });
            }
        });
    }

    public getDefaultHandle(handles: DefaultHandleInfo[]): DefaultHandleInfo {

        // OG if no default set
        const ogHandle = sortOGHandle(handles);
        if (ogHandle) return ogHandle;
    
        // filter shortest length from handles
        const sortedHandlesByLength = sortedByLength(handles);
        if (sortedHandlesByLength.length == 1) return sortedHandlesByLength[0];
    
        // earliest created slot if same length
        const sortedHandlesBySlot = sortByCreatedSlotNumber(sortedHandlesByLength);
        if (sortedHandlesBySlot.length == 1) return sortedHandlesBySlot[0];
    
        //Alphabetical if minted same time
        return sortAlphabetically(sortedHandlesBySlot);
    }

    public async getPersonalization(handle: StoredHandle | null | undefined): Promise<IPersonalization | undefined> {
        let personalization = handle?.personalization;
        if (handle?.reference_token) {
            const { projectAttributes } = this._buildPersonalizationData(handle, handle.reference_token.datum!);
            personalization = await this._buildPersonalization({ 
                personalizationDatum: projectAttributes!, 
                personalization: handle.personalization ?? { validated_by: '', trial: true, nsfw: true } 
            });
        }
        return personalization
    }
    
    public async getStartingPoint(save: (handle: StoredHandle) => void, failed = false): Promise<Point | null> {
        return this.store.getStartingPoint(save , failed);
    }

    private _buildHandle(handle: Partial<StoredHandle>, data?: IHandleMetadata): StoredHandle {
        const {name, hex, policy} = handle;
        if (!name || !hex || !policy) {
            throw new Error(`_buildHandle: "name", "hex", and "policy" are required properties. Given: ${JSON.stringify({name, hex, policy})}`);
        }
        if (!hex.endsWith(Buffer.from(name).toString('hex'))) {
            throw new Error('_buildHandle: invalid hex for Handle name');
        }
        const address = handle.resolved_addresses?.ada;
        const slotNumber = handle.updated_slot_number ?? (handle.created_slot_number ?? 0);

        // calculated
        handle.length = name.length;
        handle.rarity = getRarity(name);
        handle.characters = buildCharacters(name);
        handle.numeric_modifiers = buildNumericModifiers(name);
        handle.created_slot_number = (handle.created_slot_number ?? slotNumber);
        handle.updated_slot_number = (handle.updated_slot_number ?? slotNumber);
        handle.payment_key_hash = address ? (getPaymentKeyHash(address))! : '';
        handle.handle_type = handle.handle_type ?? (name.includes('@') ? HandleType.NFT_SUBHANDLE : HandleType.HANDLE);
        handle.image = data?.image ?? (handle.image ?? '');
        handle.standard_image = handle.standard_image ?? handle.image ?? data?.image ?? '';
        handle.version = Number(((data as any)?.core ?? data)?.version ?? (handle.version ?? 0));
        handle.sub_characters = name.includes('@') ? buildCharacters(name.split('@')[0]) : undefined;
        handle.sub_length = name.includes('@') ? name.split('@')[0].length : undefined;
        handle.sub_numeric_modifiers = name.includes('@') ? buildNumericModifiers(name.split('@')[0]) : undefined;
        handle.sub_rarity = name.includes('@') ? getRarity(name.split('@')[0]) : undefined;
        handle.datum = isDatumEndpointEnabled() ? handle.datum ?? undefined : undefined;
        handle.has_datum = !!handle.datum;
        
        // defaults
        handle.amount = handle.amount ?? 1;
        handle.og_number = Number(handle.og_number ?? MINTED_OG_LIST[handle.name!] ?? 0);
        handle.standard_image_hash = handle.standard_image_hash ?? handle.image_hash ?? '';
        handle.image_hash = handle.image_hash ?? '';
        handle.holder = handle.holder ?? '';
        handle.holder_type = handle.holder_type ?? '';
        handle.default_in_wallet = handle.default_in_wallet ?? '';
        handle.utxo = handle.utxo ?? '';
        handle.lovelace = Number(handle.lovelace ?? 0);
        handle.has_datum = handle.has_datum ?? false;
        handle.svg_version = handle.svg_version ?? '0';
        return handle as StoredHandle;
    }

    private _buildHandleHistory(newHandle: Partial<StoredHandle>, oldHandle?: Partial<StoredHandle>, testMode = true): HandleHistory | null {
        const { name } = newHandle;
        if (!oldHandle) {
            return testMode ? { old: null, new: { name } } : { old: null };
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
        return testMode ? { old, new: difference } : { old };
    }

    /**
     * @description Mutates handle - adding personalization data
     */
    private _buildPersonalizationData = (handle: StoredHandle, datum: string): { nftAttributes: IHandleMetadata | null; projectAttributes: IPzDatumConvertedUsingSchema | null; } => {
        const decodedDatum = decodeCborToJson({ cborString: datum, schema: handleDatumSchema });
        const datumObject = typeof decodedDatum === 'string' ? JSON.parse(decodedDatum) : decodedDatum;
        const { constructor_0 } = datumObject;

        const getHandleType = (hex: string): HandleType => {
            if (hex.startsWith(AssetNameLabel.LBL_000)) {
                return HandleType.VIRTUAL_SUBHANDLE;
            }

            if (hex.startsWith(AssetNameLabel.LBL_222) && handle.name.includes('@')) {
                return HandleType.NFT_SUBHANDLE;
            }

            return HandleType.HANDLE;
        };

        const requiredMetadata: IHandleMetadata = {
            name: '',
            image: '',
            mediaType: '',
            og: 0,
            og_number: 0,
            rarity: '',
            length: 0,
            characters: '',
            numeric_modifiers: '',
            version: 0,
            handle_type: getHandleType(handle.hex)
        };

        const requiredProperties: IPzDatum = {
            standard_image: '',
            default: 0,
            last_update_address: '',
            validated_by: '',
            image_hash: '',
            standard_image_hash: '',
            svg_version: '',
            agreed_terms: '',
            migrate_sig_required: 0,
            trial: 0,
            nsfw: 0
        };

        const getMissingKeys = (object: any, requiredObject: any): string[] =>
            Object.keys(requiredObject).reduce<string[]>((memo, key) => {
                if (!Object.keys(object).includes(key)) {
                    memo.push(key);
                }
                return memo;
            }, []);

        if (constructor_0 && Array.isArray(constructor_0) && constructor_0.length === 3) {
            const nftAttributes: IHandleMetadata = constructor_0[0];
            const projectAttributes: IPzDatumConvertedUsingSchema = constructor_0[2];
            const missingMetadata = getMissingKeys(nftAttributes, requiredMetadata);
            if (missingMetadata.length > 0) {
                //Logger.log({ category: LogCategory.INFO, message: `${handle} missing metadata keys: ${missingMetadata.join(', ')}`, event: 'buildValidDatum.missingMetadata' });
            }

            const missingDatum = getMissingKeys(projectAttributes, requiredProperties);
            if (missingDatum.length > 0) {
                //Logger.log({ category: LogCategory.INFO, message: `${handle} missing datum keys: ${missingDatum.join(', ')}`, event: 'buildValidDatum.missingDatum' });
            }

            handle.og_number = nftAttributes?.og_number ?? 0;
            handle.image_hash = projectAttributes?.image_hash ?? ''
            handle.standard_image_hash = projectAttributes?.standard_image_hash ?? ''
            handle.image = nftAttributes?.image ?? ''
            handle.standard_image = projectAttributes?.standard_image ?? ''
            handle.bg_image = projectAttributes?.bg_image
            handle.bg_asset = projectAttributes?.bg_asset
            handle.pfp_image = projectAttributes?.pfp_image
            handle.pfp_asset = projectAttributes?.pfp_asset
            handle.svg_version = projectAttributes?.svg_version ?? ''
            handle.default = projectAttributes?.default == true
            handle.last_update_address = projectAttributes?.last_update_address
            handle.original_address = projectAttributes?.original_address
            handle.id_hash = projectAttributes?.id_hash
            handle.pz_enabled = projectAttributes?.pz_enabled == true
            handle.last_edited_time = projectAttributes?.last_edited_time

            return {
                nftAttributes,
                projectAttributes
            };
        }

        Logger.log({ category: LogCategory.ERROR, message: `${handle.name} invalid metadata: ${JSON.stringify(datumObject)}`, event: 'buildValidDatum.invalidMetadata' });

        return {
            nftAttributes: null,
            projectAttributes: null
        };
    };

    private _getDataFromIPFSLink = async ({ link, schema }: { link?: string; schema?: any }): Promise<any | undefined> => {
        if (!link?.startsWith('ipfs://') || blackListedIpfsCids.includes(link)) return;

        const cid = link.split('ipfs://')[1];
        return await decodeCborFromIPFSFile(`${cid}`, schema);
    };

    private _buildPersonalization = async ({ personalizationDatum, personalization }: BuildPersonalizationInput): Promise<IPersonalization> => {

        if (!personalizationDatum) {
            return personalization
        }

        const { portal, designer, socials, validated_by, trial, nsfw } = personalizationDatum;

        // start timer for ipfs calls
        // const ipfsTimer = Date.now();

        const ipfsPortal = await this._getDataFromIPFSLink({ link: portal, schema: portalSchema });
        const ipfsDesigner = await this._getDataFromIPFSLink({ link: designer, schema: designerSchema });
        const ipfsSocials = await this._getDataFromIPFSLink({ link: socials, schema: socialsSchema });

        // stop timer for ipfs calls
        // const endIpfsTimer = Date.now() - ipfsTimer;
        // Logger.log({
        //     message: `IPFS calls took ${endIpfsTimer}ms`,
        //     category: LogCategory.INFO,
        //     event: 'buildPersonalization.ipfsTime'
        // });

        const updatedPersonalization: IPersonalization = {
            ...personalization,
            validated_by,
            trial,
            nsfw
        };

        if (ipfsDesigner) {
            updatedPersonalization.designer = ipfsDesigner;
        }

        if (ipfsPortal) {
            updatedPersonalization.portal = ipfsPortal;
        }

        if (ipfsSocials) {
            updatedPersonalization.socials = ipfsSocials;
        }

        // add vendor settings
        // if (ipfsVendor) {
        //     updatedPersonalization.vendor = ipfsVendor;
        // }

        return updatedPersonalization;
    };

    private _saveSlotHistory({ handleHistory, handleName, slotNumber, maxSlots = TWELVE_HOURS_IN_SLOTS }: { handleHistory: HandleHistory; handleName: string; slotNumber: number; maxSlots?: number }) {
        let slotHistory = this.store.getValueFromIndex(IndexNames.SLOT_HISTORY, slotNumber) as ISlotHistory;
        if (!slotHistory) {
            slotHistory = {
                [handleName]: handleHistory
            };
        } else {
            slotHistory[handleName] = handleHistory;
        }

        const oldestSlot = slotNumber - maxSlots;
        (this.store.getIndex(IndexNames.SLOT_HISTORY) as Map<number, ISlotHistory>).forEach((_, slot) => {
            if (slot < oldestSlot) {
                this.store.removeKeyFromIndex(IndexNames.SLOT_HISTORY, slot);
            }
        });

        this.store.setValueOnIndex(IndexNames.SLOT_HISTORY, slotNumber, slotHistory);
    }

    private _parseSubHandleSettingsDatum(datum: string) {
        try {
            const decodedSettings = decodeCborToJson({ cborString: datum, schema: subHandleSettingsDatumSchema });

            const buildTypeSettings = (typeSettings: any): ISubHandleTypeSettings => {
                return {
                    public_minting_enabled: typeSettings[0],
                    pz_enabled: typeSettings[1],
                    tier_pricing: typeSettings[2],
                    default_styles: typeSettings[3],
                    save_original_address: typeSettings[4]
                };
            };

            const settings: ISubHandleSettings = {
                nft: buildTypeSettings(decodedSettings[0]),
                virtual: buildTypeSettings(decodedSettings[1]),
                buy_down_price: decodedSettings[2],
                buy_down_paid: decodedSettings[3],
                buy_down_percent: decodedSettings[4],
                agreed_terms: decodedSettings[5],
                migrate_sig_required: decodedSettings[6],
                payment_address: decodedSettings[7]
            };

            return settings
        }
        catch (error: any) {
            Logger.log({ message: `Error decoding SubHandle owner settings datum: ${error.message}`, category: LogCategory.ERROR, event: 'handleRepository.parseSubHandleSettingsDatum' });
            return {};
        }
    }
    // Used for unit testing
    Internal = {
        buildHandleHistory: this._buildHandleHistory.bind(this),
        buildPersonalization: this._buildPersonalization.bind(this),
        buildHandle: this._buildHandle.bind(this),
        saveSlotHistory: this._saveSlotHistory.bind(this)
    }
}