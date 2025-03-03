import { Point } from '@cardano-ogmios/schema';
import { AddressDetails, AssetNameLabel, bech32FromHex, buildCharacters, buildDrep, buildNumericModifiers, decodeAddress, diff, EMPTY, getAddressHolderDetails, getPaymentKeyHash, getRarity, HandleHistory, HandlePaginationModel, HandleSearchModel, HandleType, Holder, HolderPaginationModel, HolderViewModel, HttpException, IApiMetrics, IHandlesProvider, IndexNames, IUTxO, LogCategory, Logger, NETWORK, SaveMintingTxInput, SavePersonalizationInput, SaveSubHandleSettingsInput, SaveWalletAddressMoveInput, StoredHandle, TWELVE_HOURS_IN_SLOTS } from '@koralabs/kora-labs-common';
import * as crypto from 'crypto';
import { isDatumEndpointEnabled } from '../config';
import { getDefaultHandle } from './getDefaultHandle';

export class HandlesRepository {
    private provider: IHandlesProvider;
    
    constructor(repo: IHandlesProvider) {
        this.provider = repo;
    }

    public initialize() {
        return this.provider.initialize();
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
        //console.log('lastSlot', lastSlot, 'currentSlot', currentSlot, 'currentBlockHash', currentBlockHash, 'tipBlockHash', tipBlockHash);
        return lastSlot - currentSlot < 120 && currentBlockHash == tipBlockHash;
    }

    public getHolder(address: string): Holder {
        return this.provider.getValuesFromIndex(IndexNames.HOLDER, address);
    }
    
    private filter(searchModel: HandleSearchModel) {
        const { characters, length, rarity, numeric_modifiers, search, holder_address, og, handle_type, handles } = searchModel;

        // The ['|empty|'] is important for `AND` searches here and indicates 
        // that we couldn't find any results for one of the search terms
        // When intersected with all other results, ['|empty|'] ensures empty result set
        const checkEmptyResult = (indexName: IndexNames, term: string | undefined) => {
            if (!term) return [];
            const array = this.provider.getValuesFromIndex(indexName, term);
            return array.length === 0 ? [EMPTY] : array;
        };

        // get handle name arrays for all the search parameters
        const characterArray = checkEmptyResult(IndexNames.CHARACTER, characters);
        let lengthArray: string[] = [];
        if (length?.includes('-')) {
            for (let i = parseInt(length.split('-')[0]); i <= parseInt(length.split('-')[1]); i++) {
                lengthArray = lengthArray.concat(this.provider.getValuesFromIndex(IndexNames.LENGTH, `${i}`));
            }
            if (lengthArray.length === 0) lengthArray = [EMPTY];
        } else {
            lengthArray = checkEmptyResult(IndexNames.LENGTH, length);
        }
        const rarityArray = checkEmptyResult(IndexNames.RARITY, rarity);
        const numericModifiersArray = checkEmptyResult(IndexNames.NUMERIC_MODIFIER, numeric_modifiers);
        const ogArray = og ? checkEmptyResult(IndexNames.OG, '1') : [];
        const holderArray = (() => {
            if (!holder_address) return [];
            const array = this.provider.getValuesFromIndex(IndexNames.HOLDER, holder_address);
            return array.length === 0 ? [EMPTY] : array.handles;
        })()

        const handleNames = [...new Set([characterArray, lengthArray, rarityArray, numericModifiersArray, holderArray, ogArray]
            // filter out any empty arrays
            .filter((a) => a.length)
            // Get the intersection
            .reduce((a, b) => a.filter((c: string) => b.includes(c))))]
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
        return array;
    }

    public search(pagination: HandlePaginationModel, search: HandleSearchModel) {
        const { page, sort, handlesPerPage, slotNumber } = pagination;

        let items = this.filter(search);

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

    public getAllHandleNames(search: HandleSearchModel, sort = 'asc') {
        const handles = this.filter(search);
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
            const array = Array.from(this.provider.getValuesFromIndex(IndexNames.HOLDER, h)?.handles ?? []);
            return array.length === 0 ? [EMPTY] : array;
        }
        ).concat(addresses.map((h) => {
            const hashed = crypto.createHash('md5').update(decodeAddress(h)!.slice(2), 'hex').digest('hex');
            const array = Array.from(this.provider.getValuesFromIndex(IndexNames.STAKE_KEY_HASH, hashed!) ?? []);
            return array.length === 0 ? [EMPTY] : array;
        })).flat() as string[];
    }

    public getAllHolders(params: { pagination: HolderPaginationModel; }): HolderViewModel[] {
        const { page, sort, recordsPerPage } = params.pagination;
        const items: HolderViewModel[] = [];
        this.provider.getIndex(IndexNames.HOLDER).forEach((holder: Holder) => {
            if (holder) {
                const { handles, defaultHandle, manuallySet, type, knownOwnerName } = holder;
                items.push({
                    total_handles: handles.size,
                    default_handle: defaultHandle,
                    manually_set: manuallySet,
                    address: holder.address,
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
            const array = Array.from(this.provider.getValuesFromIndex(IndexNames.STAKE_KEY_HASH, hashed!) ?? []);
            return array.length === 0 ? [EMPTY] : array;
        }).flat() as string[];
    }

    public getHandlesByPaymentKeyHashes = (hashes: string[]): string[]  => {
        return hashes.map((h) => {
            const array = Array.from(this.provider.getValuesFromIndex(IndexNames.PAYMENT_KEY_HASH, h) ?? []);
            return array.length === 0 ? [EMPTY] : array;
        }
        ).flat() as string[];
    }

    public getHandlesByAddresses = (addresses: string[]): string[] => {
        return addresses.map((h) => {
            const array = Array.from(this.provider.getValuesFromIndex(IndexNames.ADDRESS, h) ?? []);
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
        const subHandles = this.provider.getValuesFromIndex(IndexNames.SUBHANDLE, handleName) as string[];
        return [...subHandles].reduce<StoredHandle[]>((agg, item) => {
            const subHandle = this.provider.getHandle(item);
            if (subHandle) {
                agg.push(subHandle);
            }
            return agg;
        }, []);
    }

    public setMetrics(metrics: IApiMetrics): void {
        this.provider.setMetrics(metrics);
    }

    public setHolderAddressIndex(holderAddressDetails: AddressDetails, handleName?: string, isDefault?: boolean, oldHolderAddress?: string) {
        const { address: holderAddress, knownOwnerName, type } = holderAddressDetails;

        const holder = this.provider.getValuesFromIndex(IndexNames.HOLDER, holderAddress) ?? {
            handles: new Set(),
            defaultHandle: '',
            manuallySet: false,
            type,
            knownOwnerName
        };
        const getHandlesFromNames = (holder: Holder) => {
            const handles: StoredHandle[] = [];
            holder.handles.forEach((h: string) => {
                const handle = this.get(h);
                if (handle) handles.push(handle);
                else holder.handles.delete(h);
            });
            return handles;
        };
        
        if (oldHolderAddress && handleName) {
            const oldHolder: Holder = this.provider.getValuesFromIndex(IndexNames.HOLDER, oldHolderAddress);
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
            this.provider.removeKeyFromIndex(IndexNames.HOLDER, holderAddress);
            return;
        }
        // Set manuallySet to the incoming Handle if isDefault. If the incoming handleName is the same as the
        // current holder default, then we might be turning it off (unsetting it as default)
        holder.manuallySet = !!isDefault || (holder.manuallySet && holder.defaultHandle != handleName);

        // get the default handle or use the defaultName provided (this is used during personalization)
        // Set defaultHandle to incoming if isDefault, otherwise if manuallySet, then keep the current
        // default. If neither, then run getDefaultHandle algo
        holder.defaultHandle = !!isDefault && !!handleName ? handleName : holder.manuallySet ? holder.defaultHandle : getDefaultHandle(getHandlesFromNames(holder))?.name ?? '';

        this.provider.setValueOnIndex(IndexNames.HOLDER, holderAddress, holder);

    }

    public rollBackToGenesis(): void {
        this.provider.rollBackToGenesis();
    }

    public async removeHandle(handleName: string, slotNumber: number): Promise<void> {
        const handle = this.get(handleName);
        if (!handle) {
            return;
        }

        const amount = handle.amount - 1;

        if (amount === 0) {
            this.provider.removeHandle(handleName);
            const history: HandleHistory = { old: handle, new: null };
            this.saveSlotHistory({
                handleHistory: history,
                handleName,
                slotNumber
            });

            // set all one-to-many indexes
            this.provider.removeValueFromIndex(IndexNames.RARITY, handle.rarity, handleName)
            this.provider.removeValueFromIndex(IndexNames.OG, `${handle.og_number === 0 ? 0 : 1}`, handleName);
            this.provider.removeValueFromIndex(IndexNames.CHARACTER, handle.characters, handleName)
            const payment_key_hash = (await getPaymentKeyHash(handle.resolved_addresses.ada))!;
            this.provider.removeValueFromIndex(IndexNames.PAYMENT_KEY_HASH, payment_key_hash, handleName)
            this.provider.removeValueFromIndex(IndexNames.ADDRESS, handle.resolved_addresses.ada, handleName)
            this.provider.removeValueFromIndex(IndexNames.NUMERIC_MODIFIER, handle.numeric_modifiers, handleName)
            this.provider.removeValueFromIndex(IndexNames.LENGTH, `${handle.length}`, handleName)
    
            // delete from subhandles index
            if (handleName.includes('@')) {
                const rootHandle = handleName.split('@')[1];
                this.provider.removeValueFromIndex(IndexNames.SUBHANDLE, rootHandle, handleName);
            }
    
            // remove the stake key index
            this.provider.removeValueFromIndex(IndexNames.HOLDER, handle.holder, handleName);
            this.setHolderAddressIndex(getAddressHolderDetails(handle.resolved_addresses.ada));

        } else {
            const updatedHandle = { ...handle, amount };
            await this.save({ handle: updatedHandle, oldHandle: handle });
        }
    }

    public async rewindChangesToSlot({ slot, hash, lastSlot }: { slot: number; hash: string; lastSlot: number }): Promise<{ name: string; action: string; handle: Partial<StoredHandle> | undefined }[]> {
        // first we need to order the historyIndex desc by slot
        const orderedHistoryIndex = [...this.provider.getIndex(IndexNames.SLOT_HISTORY).entries()].sort((a, b) => b[0] - a[0]);
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
                        await this.save({ handle: handleHistory.old as StoredHandle, saveHistory: false });
                        continue;
                    }
                    continue;
                }

                if (handleHistory.old === null) {
                    // if the old value is null, then the handle was deleted
                    // so we need to remove it from the indexes
                    rewoundHandles.push({ name, action: 'delete', handle: undefined });
                    await this.removeHandle(name, this.getMetrics().currentSlot ?? 0);
                    continue;
                }

                // otherwise we need to update the handle with the old values
                const updatedHandle: StoredHandle = {
                    ...existingHandle,
                    ...handleHistory.old
                };

                rewoundHandles.push({ name, action: 'update', handle: updatedHandle });
                await this.save({ handle: updatedHandle, oldHandle: existingHandle, saveHistory: false });
            }

            // delete the slot key since we are rolling back to it
            this.provider.removeKeyFromIndex(IndexNames.SLOT_HISTORY, slotKey);
        }
        return rewoundHandles;
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

    public async savePersonalizationChange({ name, hex, personalization, reference_token, personalizationDatum, slotNumber, metadata }: SavePersonalizationInput): Promise<void> {
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
            await this.save({ handle });
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

        await this.save({
            handle: updatedHandle,
            oldHandle: existingHandle
        });
    }

    public async saveSubHandleSettingsChange({ name, settingsDatum, utxoDetails, slotNumber }: SaveSubHandleSettingsInput): Promise<void> {
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

        await this.save({
            handle: updatedHandle,
            oldHandle: existingHandle
        });
    }

    public async saveMintedHandle(input: SaveMintingTxInput): Promise<void> {
        const existingHandle = this.get(input.name);
        if (existingHandle) {
            // check if existing handle has a utxo. If it does, we may have a double mint
            if (existingHandle.utxo) {
                const updatedHandle = { ...existingHandle, amount: existingHandle.amount + 1 };
                await this.save({ handle: updatedHandle, oldHandle: existingHandle });
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
            await this.save({ handle: builtHandle, oldHandle: existingHandle });
            return;
        }

        const newHandle = await this._buildHandle(input);
        await this.save({ handle: newHandle });
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

        await this.save({
            handle: updatedHandle,
            oldHandle: existingHandle
        });
    }

    public async save({ handle, oldHandle, saveHistory = true }: { handle: StoredHandle; oldHandle?: StoredHandle; saveHistory?: boolean }) {
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
        const ogFlag = og_number === 0 ? 0 : 1;
        updatedHandle.payment_key_hash = payment_key_hash;
        updatedHandle.drep = buildDrep(ada, updatedHandle.id_hash?.replace('0x', ''));
        updatedHandle.holder = holder.address;
        updatedHandle.holder_type = holder.type;
        const handleDefault = handle.default;
        delete handle.default; // This is a temp property not meant to save to the handle

        // Set the main index
        this.provider.setHandle(name, updatedHandle);

        // Set default name during personalization
        this.setHolderAddressIndex(holder, name, handleDefault, oldHandle?.holder);

        // set all one-to-many indexes
        this.provider.setValueOnIndex(IndexNames.RARITY, name, rarity);
        this.provider.setValueOnIndex(IndexNames.OG, name, `${ogFlag}`);
        this.provider.setValueOnIndex(IndexNames.CHARACTER, name, characters);
        this.provider.setValueOnIndex(IndexNames.PAYMENT_KEY_HASH, name, payment_key_hash);
        this.provider.setValueOnIndex(IndexNames.NUMERIC_MODIFIER, name, numeric_modifiers);
        this.provider.setValueOnIndex(IndexNames.LENGTH, name, `${length}`);

        if (name.includes('@')) {
            const rootHandle = name.split('@')[1];
            this.provider.setValueOnIndex(IndexNames.SUBHANDLE, name, rootHandle);
        }

        if (holder.address && holder.address != '') {
            // This could return null if it is a pre-Shelley address (not bech32)
            const decodedAddress = decodeAddress(holder.address);
            const oldDecodedAddress = decodeAddress(`${oldHandle?.holder}`);
            if (decodedAddress) {
                if (oldDecodedAddress) {
                    // if there is an old stake key hash, remove it from the index
                    const oldHashofStakeKeyHash = crypto.createHash('md5').update(oldDecodedAddress.slice(2), 'hex').digest('hex')
                    this.provider.removeValueFromIndex(IndexNames.HASH_OF_STAKE_KEY_HASH, oldHashofStakeKeyHash, name);                    
                }
                const hashofStakeKeyHash = crypto.createHash('md5').update(decodedAddress.slice(2), 'hex').digest('hex')
                this.provider.setValueOnIndex(IndexNames.HASH_OF_STAKE_KEY_HASH, name, hashofStakeKeyHash);
            }
        }
        // remove the old
        this.provider.removeValueFromIndex(IndexNames.ADDRESS, oldHandle?.resolved_addresses.ada!, name); 
        // add the new
        this.provider.setValueOnIndex(IndexNames.ADDRESS, name, ada);

        // This is commented out for now as we might not need it since the history gets cleaned up on every call
        // const isWithinMaxSlot = this.metrics.lastSlot && this.metrics.currentSlot && this.metrics.lastSlot - this.metrics.currentSlot < this.twelveHourSlot;
        const isWithinMaxSlot = true;

        if (saveHistory && isWithinMaxSlot) {
            const history = this._buildHandleHistory(updatedHandle, oldHandle);
            if (history)
                this.saveSlotHistory({
                    handleHistory: history,
                    handleName: name,
                    slotNumber: updated_slot_number
                });
        }
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

    private saveSlotHistory({ handleHistory, handleName, slotNumber, maxSlots = TWELVE_HOURS_IN_SLOTS }: { handleHistory: HandleHistory; handleName: string; slotNumber: number; maxSlots?: number }) {
        let slotHistory = this.provider.getValuesFromIndex(IndexNames.SLOT_HISTORY, slotNumber);
        if (!slotHistory) {
            slotHistory = {
                [handleName]: handleHistory
            };
        } else {
            slotHistory[handleName] = handleHistory;
        }

        // const oldestSlot = slotNumber - maxSlots;
        // HandleStore.slotHistoryIndex.forEach((_, slot) => {
        //     if (slot < oldestSlot) {
        //         HandleStore.slotHistoryIndex.delete(slot);
        //     }
        // });

        this.provider.setValueOnIndex(IndexNames.SLOT_HISTORY, slotNumber, slotHistory);
    }

    public async getStartingPoint(
        save: ({ handle, oldHandle, saveHistory }: { handle: StoredHandle; oldHandle?: StoredHandle; saveHistory?: boolean }) => Promise<void>, 
        failed = false
    ): Promise<Point | null> {
        return this.provider.getStartingPoint(save , failed);
    }

    // Used for unit testing
    Internal = {
        buildHandleHistory: this._buildHandleHistory.bind(this),
        buildHandle: this._buildHandle.bind(this)
    }
}