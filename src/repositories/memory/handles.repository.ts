import { IHandleStats, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';
import { HttpException } from '../../exceptions/HttpException';
import { HolderAddressDetailsResponse } from '../../interfaces/handle.interface';
import { HandlePaginationModel } from '../../models/handlePagination.model';
import { HandleSearchModel } from '../../models/HandleSearch.model';
import { HolderPaginationModel } from '../../models/holderPagination.model';
import IHandlesRepository from '../handles.repository';
import { HandleStore } from './HandleStore';

class MemoryHandlesRepository implements IHandlesRepository {
    private search(searchModel: HandleSearchModel) {
        const EMPTY = 'empty';
        const { characters, length, rarity, numeric_modifiers, search, holder_address } = searchModel;

        // helper function to get a list of hashes from the Set indexes
        const getHandles = (index: Map<string, Set<string>>, key: string | undefined) => {
            if (!key) return [];

            const array = Array.from(index.get(key) ?? [], (value) => value);
            return array.length === 0 ? [EMPTY] : array;
        };

        // get handle name arrays for all the search parameters
        const characterArray = getHandles(HandleStore.charactersIndex, characters);
        const lengthArray = getHandles(HandleStore.lengthIndex, length);
        const rarityArray = getHandles(HandleStore.rarityIndex, rarity);
        const numericModifiersArray = getHandles(HandleStore.numericModifiersIndex, numeric_modifiers);

        const getHolderAddressHandles = (key: string | undefined) => {
            if (!key) return [];

            const array = Array.from(HandleStore.holderAddressIndex.get(key)?.handles ?? [], (value) => value);
            return array.length === 0 ? [EMPTY] : array;
        };

        const holderAddressItemsArray = getHolderAddressHandles(holder_address);

        // filter out any empty arrays
        const filteredArrays = [
            characterArray,
            lengthArray,
            rarityArray,
            numericModifiersArray,
            holderAddressItemsArray
        ].filter((a) => a.length);

        // get the intersection of all the arrays
        const handleNames = filteredArrays.length
            ? filteredArrays.reduce((a, b) => a.filter((c) => b.includes(c)))
            : [];

        // remove duplicates by getting the unique names
        const uniqueHandleNames = [...new Set(handleNames)];

        // remove the empty names
        const nonEmptyHandles = uniqueHandleNames.filter((name) => name !== EMPTY);

        const array =
            characters || length || rarity || numeric_modifiers || holder_address
                ? nonEmptyHandles.reduce<IPersonalizedHandle[]>((agg, name) => {
                      const handle = HandleStore.get(name);
                      if (handle) {
                          if (search && !handle.name.includes(search)) return agg;
                          agg.push(handle);
                      }
                      return agg;
                  }, [])
                : HandleStore.getHandles().reduce<IPersonalizedHandle[]>((agg, handle) => {
                      if (search && !handle.name.includes(search)) return agg;
                      agg.push(handle);
                      return agg;
                  }, []);

        return array;
    }

    public async getAll({
        pagination,
        search
    }: {
        pagination: HandlePaginationModel;
        search: HandleSearchModel;
    }): Promise<IPersonalizedHandle[]> {
        const { page, sort, handlesPerPage, slotNumber } = pagination;

        const items = this.search(search);

        if (slotNumber) {
            items.sort((a, b) =>
                sort === 'desc'
                    ? b.updated_slot_number - a.updated_slot_number
                    : a.updated_slot_number - b.updated_slot_number ?? 0
            );
            const slotNumberIndex = items.findIndex((a) => a.updated_slot_number === slotNumber) ?? 0;
            const handles = items.slice(slotNumberIndex, slotNumberIndex + handlesPerPage);

            return handles;
        }

        items.sort((a, b) => (sort === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
        const startIndex = (page - 1) * handlesPerPage;
        const handles = items.slice(startIndex, startIndex + handlesPerPage);

        return handles;
    }

    public async getAllHolders({
        pagination
    }: {
        pagination: HolderPaginationModel;
    }): Promise<HolderAddressDetailsResponse[]> {
        const { page, sort, recordsPerPage } = pagination;

        const items: HolderAddressDetailsResponse[] = new Array();
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
        filteredHandles.sort((a, b) => (sort === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
        return filteredHandles.map((handle) => handle.name);
    }

    public async getHandleByName(handleName: string): Promise<IPersonalizedHandle | null> {
        const handle = HandleStore.get(handleName);
        if (handle) return handle;

        return null;
    }

    public async getHolderAddressDetails(key: string): Promise<HolderAddressDetailsResponse> {
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

        const { hasDatum, datum = null } = handle;
        if (!hasDatum) return null;
        return datum;
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

    public getIsCaughtUp(): boolean {
        return HandleStore.isCaughtUp();
    }
}

export default MemoryHandlesRepository;
