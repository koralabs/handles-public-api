import { Point } from '@cardano-ogmios/schema';
import { AssetNameLabel, bech32FromHex, buildCharacters, buildDrep, buildHolderInfo, buildNumericModifiers, decodeAddress, decodeCborToJson, diff, EMPTY, ExcludesFalse, getPaymentKeyHash, getRarity, HandleHistory, HandlePaginationModel, HandleSearchModel, HandleType, Holder, HolderPaginationModel, HolderViewModel, HttpException, IApiMetrics, IHandleMetadata, IHandlesProvider, IndexNames, IPersonalization, IPzDatum, ISlotHistory, ISubHandleSettings, ISubHandleTypeSettings, IUTxO, LogCategory, Logger, NETWORK, StoredHandle, TWELVE_HOURS_IN_SLOTS } from '@koralabs/kora-labs-common';
import { designerSchema, handleDatumSchema, portalSchema, socialsSchema, subHandleSettingsDatumSchema } from '@koralabs/kora-labs-common/utils/cbor';
import * as crypto from 'crypto';
import { isDatumEndpointEnabled } from '../config';
import { BuildPersonalizationInput, ScannedHandleInfo } from '../interfaces/ogmios.interfaces';
import { getHandleNameFromAssetName } from '../services/ogmios/utils';
import { decodeCborFromIPFSFile } from '../utils/ipfs';
import { sortAlphabetically, sortByUpdatedSlotNumber, sortedByLength, sortOGHandle } from './getDefaultHandle';
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
    private provider: IHandlesProvider;
    
    constructor(repo: IHandlesProvider) {
        this.provider = repo;
    }

    public async initialize() {
        await this.provider.initialize();
        return this;
    }

    public destroy(): void {
        return this.provider.destroy();
    }

    public currentHttpStatus(): number {
        return this.isCaughtUp() ? 200 : 202        
    }

    public get(key: string): StoredHandle | null {
        return this.provider.getHandle(key);
    }

    public isCaughtUp(): boolean {
        const { lastSlot = 1, currentSlot = 0, currentBlockHash = '0', tipBlockHash = '1' } = this.provider.getMetrics();
        return lastSlot - currentSlot < 120 && currentBlockHash == tipBlockHash;
    }

    public getHolder(address: string): Holder {
        return this.provider.getValueFromIndex(IndexNames.HOLDER, address) as Holder;
    }

    public search(pagination: HandlePaginationModel, search: HandleSearchModel) {
        const { page, sort, handlesPerPage, slotNumber } = pagination;

        let items = this._filter(search);

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

    public getAllHandleNames(search?: HandleSearchModel, sort = 'asc') {
        const handles = this._filter(search);
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
    
    public getHandleByName(handleName: string): StoredHandle | null {
        return this.provider.getHandle(handleName);
    }

    public getHandleByHex(handleHex: string): StoredHandle | null {
        const handle = this.provider.getHandleByHex(handleHex);
        if (handle) return handle;
        return null;
    }

    public getMetrics(): IApiMetrics {  
        return this.provider.getMetrics();
    }

    public getHandlesByHolderAddresses = (addresses: string[]): string[]  => {
        return addresses.map((h) => {
            const array = Array.from((this.provider.getValueFromIndex(IndexNames.HOLDER, h) as Holder)?.handles ?? []);
            return array.length === 0 ? [EMPTY] : array;
        }
        ).concat(addresses.map((h) => {
            const decodedAddress = decodeAddress(h);
            if (!decodedAddress) return [EMPTY];
            const hashed = crypto.createHash('md5').update(decodedAddress, 'hex').digest('hex');
            const array = Array.from(this.provider.getValuesFromIndexedSet(IndexNames.STAKE_KEY_HASH, hashed!) ?? []);
            return array.length === 0 ? [EMPTY] : array;
        })).flat() as string[];
    }

    public getAllHolders(params: { pagination: HolderPaginationModel; }): HolderViewModel[] {
        const { page, sort, recordsPerPage } = params.pagination;
        const items: HolderViewModel[] = [];
        this.provider.getIndex(IndexNames.HOLDER).forEach((holder, key) => {
            if (holder) {
                const { handles, defaultHandle, manuallySet, type, knownOwnerName } = holder as Holder;
                items.push({
                    total_handles: handles.size,
                    default_handle: defaultHandle,
                    manually_set: manuallySet,
                    address: key as string,
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
            const array = Array.from(this.provider.getValuesFromIndexedSet(IndexNames.STAKE_KEY_HASH, hashed!) ?? []);
            return array.length === 0 ? [EMPTY] : array;
        }).flat() as string[];
    }

    public getHandlesByPaymentKeyHashes = (hashes: string[]): string[]  => {
        return hashes.map((h) => {
            const array = Array.from(this.provider.getValuesFromIndexedSet(IndexNames.PAYMENT_KEY_HASH, h) ?? []);
            return array.length === 0 ? [EMPTY] : array;
        }
        ).flat() as string[];
    }

    public getHandlesByAddresses = (addresses: string[]): string[] => {
        return addresses.map((h) => {
            const array = Array.from(this.provider.getValuesFromIndexedSet(IndexNames.ADDRESS, h) ?? []);
            return array.length === 0 ? [EMPTY] : array;
        }
        ).flat() as string[];
    }

    public getHandleDatumByName(handleName: string): string | null {
        const handle = this.provider.getHandle(handleName);
        if (!handle || !handle.utxo) {
            throw new HttpException(404, 'Not found');
        }

        const { has_datum, datum = null } = handle;
        if (!has_datum) return null;
        return datum;
    }

    public getSubHandleSettings(handleName: string): { settings?: string; utxo: IUTxO } | null {
        const handle = this.provider.getHandle(handleName);
        if (!handle || !handle.utxo) {
            throw new HttpException(404, 'Not found');
        }

        const { subhandle_settings } = handle;
        return subhandle_settings ?? null;
    }

    public getSubHandlesByRootHandle(handleName: string): StoredHandle[] {
        const subHandles = this.provider.getValuesFromIndexedSet(IndexNames.SUBHANDLE, handleName) ?? new Set<string>();
        return [...subHandles].reduce<StoredHandle[]>((agg, item) => {
            const subHandle = this.provider.getHandle(item);
            if (subHandle) {
                agg.push(subHandle);
            }
            return agg;
        }, []);
    }

    public getHandlesByNames(names: string[] | Set<string>): StoredHandle[] {
        return Array.from(names).map(n => this.get(n)).filter(ExcludesFalse);
    }

    public setMetrics(metrics: IApiMetrics): void {
        this.provider.setMetrics(metrics);
    }

    public updateHolder(handle?: StoredHandle | UpdatedOwnerHandle, oldHandle?: StoredHandle) {
        let newDefault: boolean | undefined = undefined;
        let oldDefault: boolean | undefined = undefined;
        if (oldHandle) {
            const oldHolderInfo = buildHolderInfo(oldHandle.resolved_addresses.ada);
            const oldHolder = this.provider.getValueFromIndex(IndexNames.HOLDER, oldHolderInfo.address) as Holder
            if (oldHolder) {
                oldDefault = oldHolder.manuallySet && oldHolder.defaultHandle == oldHandle.name;
                oldHolder.handles.delete(oldHandle.name);
                if (oldHolder.handles.size === 0) {
                    this.provider.removeKeyFromIndex(IndexNames.HOLDER, oldHolderInfo.address);
                } else {
                    oldHolder.manuallySet = oldHolder.manuallySet && oldHolder.defaultHandle != oldHandle.name;
                    oldHolder.defaultHandle = oldHolder.manuallySet ? oldHolder.defaultHandle : this.getDefaultHandle(this.getHandlesByNames(oldHolder.handles))?.name ?? '';
                    this.provider.setValueOnIndex(IndexNames.HOLDER, oldHolderInfo.address, oldHolder);
                }
            }
        }

        if (!handle) return {newDefault, oldDefault};

        const holderInfo = buildHolderInfo(handle.resolved_addresses.ada);
        const { address, knownOwnerName, type } = holderInfo;

        const holder = (this.provider.getValueFromIndex(IndexNames.HOLDER, address) ?? {
            handles: new Set(),
            defaultHandle: '',
            manuallySet: false,
            type,
            knownOwnerName
        }) as Holder;

        // add the new name if provided and does not already exist
        if (!holder.handles.has(handle.name)) {
            holder.handles.add(handle.name);
        }

        // if by this point, we have no handles, we need to remove the holder address from the index
        if (holder.handles.size === 0) {
            this.provider.removeKeyFromIndex(IndexNames.HOLDER, address);
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
                else return this.getDefaultHandle([handle, ...this.getHandlesByNames(holder.handles)])?.name ?? ''}
        })();

        handle.holder = address;
        handle.holder_type = holder.type;
        newDefault = handle.default;
        delete handle.default; // This is a temp property not meant to save to the handle

        this.provider.setValueOnIndex(IndexNames.HOLDER, address, holder);
        
        if (address && address != '') {
            // This could return null if it is a pre-Shelley address (not bech32)
            const decodedAddress = decodeAddress(address);
            const oldDecodedAddress = decodeAddress(`${oldHandle?.holder}`);
            if (decodedAddress) {
                if (oldDecodedAddress) {
                    // if there is an old stake key hash, remove it from the index
                    const oldHashofStakeKeyHash = crypto.createHash('md5').update(oldDecodedAddress, 'hex').digest('hex')
                    this.provider.removeValueFromIndexedSet(IndexNames.HASH_OF_STAKE_KEY_HASH, oldHashofStakeKeyHash, handle.name);                    
                }
                const hashofStakeKeyHash = handle.id_hash ? handle.id_hash.replace('0x', '').slice(34) : crypto.createHash('md5').update(decodedAddress, 'hex').digest('hex')
                this.provider.addValueToIndexedSet(IndexNames.HASH_OF_STAKE_KEY_HASH, hashofStakeKeyHash, handle.name);
            }
        }
        return {newDefault, oldDefault};
    }

    public rollBackToGenesis(): void {
        this.provider.rollBackToGenesis();
    }

    public async removeHandle(handle: StoredHandle | RewoundHandle, slotNumber: number): Promise<void> {
        const handleName = handle.name;
        const amount = handle.amount - 1;

        if (amount === 0) {
            this.provider.removeHandle(handle.name);
            if (!(handle instanceof RewoundHandle)) {
                const history: HandleHistory = { old: handle, new: null };
                this._saveSlotHistory({
                    handleHistory: history,
                    handleName,
                    slotNumber
                });
            }

            // set all one-to-many indexes
            this.provider.removeValueFromIndexedSet(IndexNames.RARITY, handle.rarity, handleName)
            this.provider.removeValueFromIndexedSet(IndexNames.OG, handle.og_number === 0 ? 0 : 1, handleName);
            this.provider.removeValueFromIndexedSet(IndexNames.CHARACTER, handle.characters, handleName)
            const payment_key_hash = (await getPaymentKeyHash(handle.resolved_addresses.ada))!;
            this.provider.removeValueFromIndexedSet(IndexNames.PAYMENT_KEY_HASH, payment_key_hash, handleName)
            this.provider.removeValueFromIndexedSet(IndexNames.ADDRESS, handle.resolved_addresses.ada, handleName)
            this.provider.removeValueFromIndexedSet(IndexNames.NUMERIC_MODIFIER, handle.numeric_modifiers, handleName)
            this.provider.removeValueFromIndexedSet(IndexNames.LENGTH, handle.length, handleName)
    
            // delete from subhandles index
            if (handleName.includes('@')) {
                const rootHandle = handleName.split('@')[1];
                this.provider.removeValueFromIndexedSet(IndexNames.SUBHANDLE, rootHandle, handleName);
            }
    
            // remove the stake key index
            this.updateHolder(undefined, handle);

        } else {
            const updatedHandle = { ...handle, amount };
            await this.save(updatedHandle, handle);
        }
    }

    public async rewindChangesToSlot({ slot, hash, lastSlot }: { slot: number; hash: string; lastSlot: number }): Promise<{ name: string; action: string; handle: Partial<StoredHandle> | undefined }[]> {
        // first we need to order the historyIndex desc by slot
        const orderedHistoryIndex = [...this.provider.getIndex(IndexNames.SLOT_HISTORY) as Map<number, ISlotHistory>].sort((a, b) => b[0] - a[0]);
        const rewoundHandles = [];

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
                const handleHistory = history[name];

                const existingHandle = this.get(name);
                if (!existingHandle) {
                    if (handleHistory.old) {
                        rewoundHandles.push({ name, action: 'create', handle: handleHistory.old });
                        await this.save(new RewoundHandle(handleHistory.old as StoredHandle));
                        continue;
                    }
                    continue;
                }

                if (handleHistory.old === null) {
                    // if the old value is null, then the handle was deleted
                    // so we need to remove it from the indexes
                    rewoundHandles.push({ name, action: 'delete', handle: undefined });
                    await this.removeHandle(new RewoundHandle(existingHandle), this.getMetrics().currentSlot ?? 0);
                    continue;
                }

                // otherwise we need to update the handle with the old values
                const updatedHandle: StoredHandle = {
                    ...existingHandle,
                    ...handleHistory.old
                };

                rewoundHandles.push({ name, action: 'update', handle: updatedHandle });
                await this.save(new RewoundHandle(updatedHandle), existingHandle);
            }

            // delete the slot key since we are rolling back to it
            this.provider.removeKeyFromIndex(IndexNames.SLOT_HISTORY, slotKey);
        }
        return rewoundHandles;
    }
    
    public async processScannedHandleInfo(scannedHandleInfo: ScannedHandleInfo): Promise<void> {
        const {assetName, utxo, lovelace, datum, address, policy, slotNumber, script, metadata, isMintTx} = scannedHandleInfo
        const { hex, name, isCip67, assetLabel } = getHandleNameFromAssetName(assetName);
        const data = metadata && (metadata[isCip67 ? hex : name] as unknown as IHandleMetadata);
        const existingHandle = this.get(name) ?? undefined;
        let handle = structuredClone(existingHandle) ?? await this._buildHandle({name, hex, policy, resolved_addresses: {ada: address}, updated_slot_number: slotNumber}, data);
        const [txId, indexString] = utxo.split('#');
        const index = parseInt(indexString);

        const utxoDetails = {
            tx_id: txId,
            index,
            lovelace,
            datum: datum ?? '',
            address
        };

        switch (assetLabel) {
            case null:
            case AssetNameLabel.NONE:
            case AssetNameLabel.LBL_222:
                if (!existingHandle && !isMintTx) {
                    Logger.log({ message: `Handle was updated but there is no existing handle in storage with name: ${name}`, category: LogCategory.NOTIFY, event: 'saveHandleUpdate.noHandleFound' });
                    return;
                }
                // check if existing handle has a utxo. If it does, we may have a double mint
                if (isMintTx && existingHandle?.utxo) {
                    handle.amount = (handle.amount ?? 1) + 1;
                    Logger.log({ message: `POSSIBLE DOUBLE MINT!!!\n UTxO already found for minted Handle ${name}!`, category: LogCategory.NOTIFY, event: 'saveHandleUpdate.utxoAlreadyExists' });
                }
                handle.script = script;
                handle.datum = isDatumEndpointEnabled() && datum ? datum : undefined;
                handle.has_datum = !!datum;
                handle.lovelace = lovelace;
                handle.utxo = utxo;
                handle.updated_slot_number = slotNumber;
                handle.resolved_addresses!.ada = address;
                handle = new UpdatedOwnerHandle(handle);
                break;
            case AssetNameLabel.LBL_100:
            case AssetNameLabel.LBL_000:
            {
                if (!datum) {
                    Logger.log({ message: `No datum for reference token ${assetName}`, category: LogCategory.ERROR, event: 'processScannedHandleInfo.referenceToken.noDatum' });
                    return;
                }

                let personalization = handle.personalization ?? { validated_by: '', trial: true, nsfw: true };
                const { metadata,  personalizationDatum } = await this._buildPersonalizationData(name, hex, datum);
                if (personalizationDatum) {
                    // populate personalization from the reference token
                    personalization = await this._buildPersonalization({ personalizationDatum, personalization });
                }
                const addresses = personalizationDatum?.resolved_addresses
                    ? Object.entries(personalizationDatum?.resolved_addresses ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
                        if (key !== 'ada') { acc[key] = value as string; }
                        return acc;
                    }, {})
                    : {};
                const virtual = personalizationDatum?.virtual ? { expires_time: personalizationDatum.virtual.expires_time, public_mint: !!personalizationDatum.virtual.public_mint } : undefined;
                handle.og_number = metadata?.og_number ?? 0;
                handle.image_hash = personalizationDatum?.image_hash ?? ''
                handle.standard_image_hash = personalizationDatum?.standard_image_hash ?? ''
                handle.bg_image = personalizationDatum?.bg_image
                handle.bg_asset = personalizationDatum?.bg_asset
                handle.pfp_image = personalizationDatum?.pfp_image
                handle.pfp_asset = personalizationDatum?.pfp_asset
                handle.updated_slot_number = slotNumber
                handle.resolved_addresses = {
                    ...addresses,
                    ada: existingHandle?.resolved_addresses?.ada ?? ''
                }
                handle.personalization = personalization
                handle.reference_token = utxoDetails
                handle.svg_version = personalizationDatum?.svg_version ?? ''
                handle.default = personalizationDatum?.default ?? false
                handle.last_update_address = personalizationDatum?.last_update_address
                handle.virtual = virtual
                handle.original_address = personalizationDatum?.original_address
                handle.id_hash = personalizationDatum?.id_hash
                handle.pz_enabled = personalizationDatum?.pz_enabled ?? false
                handle.last_edited_time = personalizationDatum?.last_edited_time
                if (assetLabel == AssetNameLabel.LBL_000) {
                    handle.utxo = `${utxoDetails.tx_id}#${utxoDetails.index}`;
                    handle.resolved_addresses!.ada = bech32FromHex(personalizationDatum.resolved_addresses.ada.replace('0x', ''), isTestnet);
                    handle.handle_type = HandleType.VIRTUAL_SUBHANDLE;
                }
                break;
            }
            case AssetNameLabel.LBL_001:
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
                    ...(await this._parseSubHandleSettingsDatum(datum)),
                    utxo: utxoDetails
                }
                handle.updated_slot_number = slotNumber;
                handle.resolved_addresses = {
                    ...(existingHandle?.resolved_addresses ?? {}),
                    ada: existingHandle?.resolved_addresses?.ada ?? ''
                }
                break;
            default:
                Logger.log({ message: `Unknown asset name ${assetName}`, category: LogCategory.ERROR, event: 'processScannedHandleInfo.unknownAssetName' });
        }
        
        await this.save(handle, existingHandle);

    }

    public async save(handle: StoredHandle | RewoundHandle | UpdatedOwnerHandle, oldHandle?: StoredHandle) {
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

        const payment_key_hash = (await getPaymentKeyHash(ada))!;
        const ogFlag = og_number === 0 ? 0 : 1;
        handle.payment_key_hash = payment_key_hash;
        handle.drep = buildDrep(ada, handle.id_hash?.replace('0x', ''));

        const {newDefault, oldDefault} = this.updateHolder(handle, oldHandle);

        // Set the main index (SAVES THE HANDLE)
        this.provider.setHandle(name, handle);

        // set all one-to-many indexes
        this.provider.addValueToIndexedSet(IndexNames.RARITY, rarity, name);
        this.provider.addValueToIndexedSet(IndexNames.OG, ogFlag, name);
        this.provider.addValueToIndexedSet(IndexNames.CHARACTER, characters, name);
        this.provider.addValueToIndexedSet(IndexNames.PAYMENT_KEY_HASH, payment_key_hash, name);
        this.provider.addValueToIndexedSet(IndexNames.NUMERIC_MODIFIER, numeric_modifiers, name);
        this.provider.addValueToIndexedSet(IndexNames.LENGTH, length, name);

        if (name.includes('@')) {
            const rootHandle = name.split('@')[1];
            this.provider.addValueToIndexedSet(IndexNames.SUBHANDLE, rootHandle, name);
        }

        // remove the old
        this.provider.removeValueFromIndexedSet(IndexNames.ADDRESS, oldHandle?.resolved_addresses.ada!, name); 
        // add the new
        this.provider.addValueToIndexedSet(IndexNames.ADDRESS, ada, name);

        if (!(handle instanceof RewoundHandle)) {
            const history = this._buildHandleHistory({...handle, default: newDefault}, oldHandle ? {...oldHandle, default: oldDefault || undefined} : undefined);
            if (history)
                this._saveSlotHistory({
                    handleHistory: history,
                    handleName: name,
                    slotNumber: updated_slot_number
                });
        }
    }

    public getDefaultHandle(handles: StoredHandle[]): StoredHandle {

        // OG if no default set
        const ogHandle = sortOGHandle(handles);
        if (ogHandle) return ogHandle;
    
        // filter shortest length from handles
        const sortedHandlesByLength = sortedByLength(handles);
        if (sortedHandlesByLength.length == 1) return sortedHandlesByLength[0];
    
        //Latest slot number if same length
        const sortedHandlesBySlot = sortByUpdatedSlotNumber(sortedHandlesByLength);
        if (sortedHandlesBySlot.length == 1) return sortedHandlesBySlot[0];
    
        //Alphabetical if minted same time
        return sortAlphabetically(sortedHandlesBySlot);
    }

    public async getStartingPoint(
        save: (handle: StoredHandle) => Promise<void>, 
        failed = false
    ): Promise<Point | null> {
        return this.provider.getStartingPoint(save , failed);
    }
    
    private _filter(searchModel?: HandleSearchModel) {
        if (!searchModel) return this.provider.getAllHandles();

        const { characters, length, rarity, numeric_modifiers, search, holder_address, og, handle_type, handles } = searchModel;

        // The ['|empty|'] is important for `AND` searches here and indicates 
        // that we couldn't find any results for one of the search terms
        // When intersected with all other results, ['|empty|'] ensures empty result set
        const checkEmptyResult = (indexName: IndexNames, term: string | number | undefined) => {
            if (!term) return [];
            const set = this.provider.getValuesFromIndexedSet(indexName, term) ?? new Set<string>();
            return set.size === 0 ? [EMPTY] : [...set];
        };

        // get handle name arrays for all the search parameters
        const characterArray = checkEmptyResult(IndexNames.CHARACTER, characters);
        let lengthArray: string[] = [];
        if (length?.includes('-')) {
            for (let i = parseInt(length.split('-')[0]); i <= parseInt(length.split('-')[1]); i++) {
                lengthArray = lengthArray.concat([...this.provider.getValuesFromIndexedSet(IndexNames.LENGTH, i) ?? new Set<string>()]);
            }
            if (lengthArray.length === 0) lengthArray = [EMPTY];
        } else {
            lengthArray = checkEmptyResult(IndexNames.LENGTH, parseInt(length || '0'));
        }
        const rarityArray = checkEmptyResult(IndexNames.RARITY, rarity);
        const numericModifiersArray = checkEmptyResult(IndexNames.NUMERIC_MODIFIER, numeric_modifiers);
        const ogArray = og ? checkEmptyResult(IndexNames.OG, 1) : [];
        const holderArray = (() => {
            if (!holder_address) return [];
            const holder = this.provider.getValueFromIndex(IndexNames.HOLDER, holder_address) as Holder;
            return holder ? [...holder.handles] : [EMPTY];
        })();

        // filter out any empty arrays
        const filtered = [characterArray, lengthArray, rarityArray, numericModifiersArray, holderArray, ogArray].filter((a) => a?.length)
        // Get the intersection
        const handleNames = [...new Set(filtered.length ? filtered.reduce((a, b) => a.filter((c: string) => b.includes(c))) : [])]
            // if there is an EMPTY here, there is no result set
            .filter((name) => name !== EMPTY)

        let array =
            characters || length || rarity || numeric_modifiers || holder_address || og
                ? handleNames.reduce<StoredHandle[]>((agg, name) => {
                    const handle = this.get(name as string);
                    if (handle) {
                        if (search && !handle.name.includes(search)) return agg;
                        if (handle_type && handle.handle_type !== handle_type) return agg;
                        if (handles && !handles.includes(handle.name)) return agg;
                        agg.push(handle);
                    }
                    return agg;
                }, [])
                : this.provider.getAllHandles().reduce<StoredHandle[]>((agg, handle) => {
                    if (search && !(handle.name.includes(search) || handle.hex.includes(search))) return agg;
                    if (handle_type && handle.handle_type !== handle_type) return agg;
                    if (handles && !handles.includes(handle.name)) return agg;

                    agg.push(handle);
                    return agg;
                }, []);

        if (searchModel.personalized) {
            array = array.filter((handle) => handle.image_hash != handle.standard_image_hash);
        }
        if (searchModel.public_subhandles) {
            array = array.filter((handle) => handle.subhandle_settings?.nft?.public_minting_enabled || handle.subhandle_settings?.virtual?.public_minting_enabled);
        }
        return array;
    }

    private async _buildHandle(handle: Partial<StoredHandle>, data?: IHandleMetadata): Promise<StoredHandle> {
        const {name, hex, policy} = handle;
        if (!name || !hex || !policy) {
            throw new Error('_buildHandle: "name", "hex", and "policy" are required properties');
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
        handle.payment_key_hash = address ? (await getPaymentKeyHash(address))! : '';
        handle.handle_type = handle.handle_type ?? (name.includes('@') ? HandleType.NFT_SUBHANDLE : HandleType.HANDLE);
        handle.image = data?.image ?? (handle.image ?? '');
        handle.standard_image = data?.image ?? handle.standard_image ?? handle.image ?? '';
        handle.version = Number(((data as any)?.core ?? data)?.version ?? (handle.version ?? 0));
        handle.sub_characters = name.includes('@') ? buildCharacters(name.split('@')[0]) : undefined;
        handle.sub_length = name.includes('@') ? name.split('@')[0].length : undefined;
        handle.sub_numeric_modifiers = name.includes('@') ? buildNumericModifiers(name.split('@')[0]) : undefined;
        handle.sub_rarity = name.includes('@') ? getRarity(name.split('@')[0]) : undefined;
        handle.datum = isDatumEndpointEnabled() ? handle.datum ?? undefined : undefined;
        handle.has_datum = !!handle.datum;
        
        // defaults
        handle.amount = handle.amount ?? 1;
        handle.og_number = Number(handle.og_number ?? 0);
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

    private _buildPersonalizationData = async (handle: string, hex: string, datum: string) => {
        const decodedDatum = await decodeCborToJson({ cborString: datum, schema: handleDatumSchema });
        const datumObject = typeof decodedDatum === 'string' ? JSON.parse(decodedDatum) : decodedDatum;
        const { constructor_0 } = datumObject;

        const getHandleType = (hex: string): HandleType => {
            if (hex.startsWith(AssetNameLabel.LBL_000)) {
                return HandleType.VIRTUAL_SUBHANDLE;
            }

            if (hex.startsWith(AssetNameLabel.LBL_222) && handle.includes('@')) {
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
            handle_type: getHandleType(hex)
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
            const missingMetadata = getMissingKeys(constructor_0[0], requiredMetadata);
            if (missingMetadata.length > 0) {
                Logger.log({ category: LogCategory.INFO, message: `${handle} missing metadata keys: ${missingMetadata.join(', ')}`, event: 'buildValidDatum.missingMetadata' });
            }

            const missingDatum = getMissingKeys(constructor_0[2], requiredProperties);
            if (missingDatum.length > 0) {
                Logger.log({ category: LogCategory.INFO, message: `${handle} missing datum keys: ${missingDatum.join(', ')}`, event: 'buildValidDatum.missingDatum' });
            }

            return {
                metadata: constructor_0[0],
                personalizationDatum: constructor_0[2]
            };
        }

        Logger.log({ category: LogCategory.ERROR, message: `${handle} invalid metadata: ${JSON.stringify(datumObject)}`, event: 'buildValidDatum.invalidMetadata' });

        return {
            metadata: null,
            personalizationDatum: null
        };
    };

    private _getDataFromIPFSLink = async ({ link, schema }: { link?: string; schema?: any }): Promise<any | undefined> => {
        if (!link?.startsWith('ipfs://') || blackListedIpfsCids.includes(link)) return;

        const cid = link.split('ipfs://')[1];
        return decodeCborFromIPFSFile(`${cid}`, schema);
    };

    private _buildPersonalization = async ({ personalizationDatum, personalization }: BuildPersonalizationInput): Promise<IPersonalization> => {
        const { portal, designer, socials, vendor, validated_by, trial, nsfw } = personalizationDatum;

        // start timer for ipfs calls
        const ipfsTimer = Date.now();

        const [ipfsPortal, ipfsDesigner, ipfsSocials] = await Promise.all([{ link: portal, schema: portalSchema }, { link: designer, schema: designerSchema }, { link: socials, schema: socialsSchema }, { link: vendor }].map(this._getDataFromIPFSLink));

        // stop timer for ipfs calls
        const endIpfsTimer = Date.now() - ipfsTimer;
        Logger.log({
            message: `IPFS calls took ${endIpfsTimer}ms`,
            category: LogCategory.INFO,
            event: 'buildPersonalization.ipfsTime'
        });

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
        let slotHistory = this.provider.getValueFromIndex(IndexNames.SLOT_HISTORY, slotNumber) as ISlotHistory;
        if (!slotHistory) {
            slotHistory = {
                [handleName]: handleHistory
            };
        } else {
            slotHistory[handleName] = handleHistory;
        }

        const oldestSlot = slotNumber - maxSlots;
        (this.provider.getIndex(IndexNames.SLOT_HISTORY) as Map<number, ISlotHistory>).forEach((_, slot) => {
            if (slot < oldestSlot) {
                this.provider.removeKeyFromIndex(IndexNames.SLOT_HISTORY, slot);
            }
        });

        this.provider.setValueOnIndex(IndexNames.SLOT_HISTORY, slotNumber, slotHistory);
    }

    private async _parseSubHandleSettingsDatum(datum: string) {
        const decodedSettings = await decodeCborToJson({ cborString: datum, schema: subHandleSettingsDatumSchema });

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
    // Used for unit testing
    Internal = {
        buildHandleHistory: this._buildHandleHistory.bind(this),
        buildPersonalization: this._buildPersonalization.bind(this),
        buildHandle: this._buildHandle.bind(this),
        saveSlotHistory: this._saveSlotHistory.bind(this)
    }
}