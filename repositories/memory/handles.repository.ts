import {
    decodeAddress,
    HandlePaginationModel, HandleSearchModel,
    HolderAddressDetails,
    HolderPaginationModel,
    HttpException,
    IHandlesRepository,
    IHandleStats,
    IHandleStoreMetrics,
    IUTxO,
    LogCategory, Logger,
    SaveMintingTxInput, SavePersonalizationInput, SaveSubHandleSettingsInput, SaveWalletAddressMoveInput,
    StoredHandle
} from '@koralabs/kora-labs-common';
import * as crypto from 'crypto';
import { memoryWatcher } from '../../services/ogmios/utils';
import { HandleStore } from './HandleStore';

class MemoryHandlesRepository implements IHandlesRepository {
    public EMPTY = '|empty|';
    private intervals: NodeJS.Timeout[] = [];

    constructor() {}

    public initialize(): IHandlesRepository {
        // const metricsInterval = setInterval(() => {
        //     if (process.env.CONSOLE_STATUS === 'true') {
        //         const metrics = HandleStore.getMetrics();
        //         if (!metrics) return;

        //         const {
        //             percentageComplete,
        //             currentMemoryUsed,
        //             buildingElapsed,
        //             memorySize,
        //             handleCount,
        //             ogmiosElapsed,
        //             slotDate
        //         } = metrics;

        //         writeConsoleLine(
        //             this.startTime,
        //             `${percentageComplete}% Completed | ${currentMemoryUsed}MB Used | ${handleCount} Total Handles | ${memorySize} Object Size | ${ogmiosElapsed} Ogmios Elapsed | ${buildingElapsed} Building Elapsed | ${slotDate.toISOString()} Slot Date`
        //         );
        //     }
        // }, 1000);

        if (this.intervals.length === 0) {
            const saveFilesInterval = setInterval(() => {
                const { current_slot, current_block_hash } = HandleStore.getMetrics();

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

                HandleStore.saveHandlesFile(current_slot, current_block_hash);

                memoryWatcher();
            }, 10 * 60 * 1000);

            const setMemoryInterval = setInterval(() => {
                const memorySize = HandleStore.memorySize();
                HandleStore.setMetrics({ memorySize });
            }, 60000);

            this.intervals = [saveFilesInterval, setMemoryInterval];
        }
        return this;
    }

    public destroy(): void {
        this.intervals.map((i) => clearInterval(i));
    }

    public isCaughtUp(): boolean {
        return HandleStore.isCaughtUp();
    }

    public getTimeMetrics() {
        return HandleStore.getTimeMetrics();
    }
    
    public setMetrics(metrics: IHandleStoreMetrics){
        HandleStore.setMetrics(metrics);
    }
    
    public getMetrics(): IHandleStats {
        return HandleStore.getMetrics();
    }

    public async prepareHandlesStorage(loadS3: boolean = true): Promise<{ slot: number; hash: string; } | null> {
        return await HandleStore.prepareHandlesStorage(loadS3);
    }

    public async rollBackToGenesis(): Promise<void> {
        return await HandleStore.rollBackToGenesis();
    }

    public async burnHandle(handleName: string, slotNumber: number): Promise<void> {
        return await HandleStore.burnHandle(handleName, slotNumber);
    }

    public async rewindChangesToSlot(slot: { slot: number; hash: string; lastSlot: number; }): Promise<{ name: string; action: string; handle: Partial<StoredHandle> | undefined; }[]> {
        return await HandleStore.rewindChangesToSlot(slot);
    }

    public async savePersonalizationChange(change: SavePersonalizationInput): Promise<void> {
        return await HandleStore.savePersonalizationChange(change);
    }

    public async saveSubHandleSettingsChange(change: SaveSubHandleSettingsInput): Promise<void> {
        return await HandleStore.saveSubHandleSettingsChange(change);
    }

    public async saveMintedHandle(input: SaveMintingTxInput): Promise<void> {
        return await HandleStore.saveMintedHandle(input);
    }

    public async saveHandleUpdate(update: SaveWalletAddressMoveInput): Promise<void> {
        return await HandleStore.saveHandleUpdate(update);
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
                    const handle = HandleStore.get(name as string);
                    if (handle) {
                        if (search && !handle.name.includes(search)) return agg;
                        if (handle_type && handle.handle_type !== handle_type) return agg;
                        if (handles && !(handles.includes(handle.name) || handles.includes(handle.hex))) return agg;
                        agg.push(handle);
                    }
                    return agg;
                }, [])
                : HandleStore.getHandles().reduce<StoredHandle[]>((agg, handle) => {
                    if (search && !(handle.name.includes(search) || handle.hex.includes(search))) return agg;
                    if (handle_type && handle.handle_type !== handle_type) return agg;
                    if (handles && !(handles.includes(handle.name) || handles.includes(handle.hex))) return agg;

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
            items.sort((a, b) => (sort === 'desc' ? b.updated_slot_number - a.updated_slot_number : a.updated_slot_number - b.updated_slot_number ?? 0));
            const slotNumberIndex = items.findIndex((a) => a.updated_slot_number === slotNumber) ?? 0;
            const handles = items.slice(slotNumberIndex, slotNumberIndex + handlesPerPage);

            return { searchTotal: handles.length, handles };
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

        return { searchTotal: handles.length, handles };
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
            const hashed = crypto.createHash('md5').update(Buffer.from(decodeAddress(h)!.slice(2), 'hex')).digest('hex');
            const array = Array.from(HandleStore.hashOfStakeKeyHashIndex.get(hashed!) ?? []);
            return array.length === 0 ? [this.EMPTY] : array;
        })).flat() as string[];
    }

    public getHandlesByStakeKeyHashes = (hashes: string[]): string[]  => {
        return hashes.map((h) => {
            const hashed = crypto.createHash('md5').update(Buffer.from(h, 'hex')).digest('hex');
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
        const handle = HandleStore.get(handleName);
        if (handle) return handle;

        return null;
    }

    public async getHandleByHex(handleHex: string): Promise<StoredHandle | null> {
        const handle = HandleStore.getByHex(handleHex);
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
        const handle = HandleStore.get(handleName);
        if (!handle || !handle.utxo) {
            throw new HttpException(404, 'Not found');
        }

        const { has_datum, datum = null } = handle;
        if (!has_datum) return null;
        return datum;
    }

    public async getSubHandleSettings(handleName: string): Promise<{ settings?: string; utxo: IUTxO } | null> {
        const handle = HandleStore.get(handleName);
        if (!handle || !handle.utxo) {
            throw new HttpException(404, 'Not found');
        }

        const { subhandle_settings } = handle;
        return subhandle_settings ?? null;
    }

    public async getSubHandles(handleName: string): Promise<StoredHandle[]> {
        const subHandles = HandleStore.getRootHandleSubHandles(handleName);
        return [...subHandles].reduce<StoredHandle[]>((agg, item) => {
            const subHandle = HandleStore.get(item);
            if (subHandle) {
                agg.push(subHandle);
            }
            return agg;
        }, []);
    }

    public getHandleStats(): IHandleStats {
        return HandleStore.getMetrics();
    }

    public getTotalHandlesStats(): { total_handles: number; total_holders: number } {
        return {
            total_handles: HandleStore.count(),
            total_holders: HandleStore.holderAddressIndex.size
        };
    }

    public currentHttpStatus(): number {
        return HandleStore.isCaughtUp() ? 200 : 202;
    }
}

export default MemoryHandlesRepository;
