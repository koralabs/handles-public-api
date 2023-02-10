import { IHandle, IHandleStats, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import { HttpException } from '../../exceptions/HttpException';
import { HolderAddressDetailsResponse } from '../../interfaces/handle.interface';

import { HandlePaginationModel } from '../../models/handlePagination.model';
import { HandleSearchModel } from '../../models/HandleSearch.model';
import { HolderPaginationModel } from '../../models/holderPagination.model';
import { queryStateByUtxo } from '../../services/ogmios/stateQuery/ogmios.stateQuery.service';
import IHandlesRepository from '../handles.repository';
import { HandleStore } from './HandleStore';

class MemoryHandlesRepository implements IHandlesRepository {    
    private search(searchModel: HandleSearchModel) {
        const EMPTY = 'empty';
        const { characters, length, rarity, numeric_modifiers, search, holder_address } = searchModel;

        // helper function to get a list of hashes from the Set indexes
        const getHashes = (index: Map<string, Set<string>>, key: string | undefined) => {
            if (!key) return [];

            const array = Array.from(index.get(key) ?? [], (value) => value);
            return array.length === 0 ? [EMPTY] : array;
        };

        // get hex arrays for all the search parameters
        const characterArray = getHashes(HandleStore.charactersIndex, characters);
        const lengthArray = getHashes(HandleStore.lengthIndex, length);
        const rarityArray = getHashes(HandleStore.rarityIndex, rarity);
        const numericModifiersArray = getHashes(HandleStore.numericModifiersIndex, numeric_modifiers);

        const getHolderAddressHashes = (key: string | undefined) => {
            if (!key) return [];

            const array = Array.from(HandleStore.holderAddressIndex.get(key)?.hexes ?? [], (value) => value);
            return array.length === 0 ? [EMPTY] : array;
        };

        const holderAddressItemsArray = getHolderAddressHashes(holder_address);

        // filter out any empty arrays
        const filteredArrays = [
            characterArray,
            lengthArray,
            rarityArray,
            numericModifiersArray,
            holderAddressItemsArray
        ].filter((a) => a.length);

        // get the intersection of all the arrays
        const handleHexes = filteredArrays.length
            ? filteredArrays.reduce((a, b) => a.filter((c) => b.includes(c)))
            : [];

        // remove duplicates by getting the unique hexes
        const uniqueHexes = [...new Set(handleHexes)];

        // remove the empty hexes
        const nonEmptyHexes = uniqueHexes.filter((hex) => hex !== EMPTY);

        const array =
            characters || length || rarity || numeric_modifiers || holder_address
                ? nonEmptyHexes.reduce<IHandle[]>((agg, hex) => {
                      const handle = HandleStore.get(hex);
                      if (handle) {
                          if (search && !handle.name.includes(search)) return agg;
                          agg.push(handle);
                      }
                      return agg;
                  }, [])
                : HandleStore.getHandles().reduce<IHandle[]>((agg, handle) => {
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
    }): Promise<IHandle[]> {
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

    public async getAllHolders({pagination}: { pagination: HolderPaginationModel; }): Promise<HolderAddressDetailsResponse[]>{
        const { page, sort, recordsPerPage } = pagination;

        const items = new Array<HolderAddressDetailsResponse>
        Object.keys(HandleStore.holderAddressIndex).forEach(function(key) {
            const holderAddressDetails = HandleStore.holderAddressIndex.get(key);
            if (holderAddressDetails){
                const { hexes,  defaultHandle, manuallySet, type, knownOwnerName } = holderAddressDetails;
                items.push({
                    total_handles: hexes.size,
                    default_handle: defaultHandle,
                    manually_set: manuallySet,
                    address: key,
                    known_owner_name: knownOwnerName,
                    type
                })
            }
          });

        items.sort((a, b) => (sort === 'desc' ? b.total_handles - a.total_handles: a.total_handles - b.total_handles));
        const startIndex = (page - 1) * recordsPerPage;
        const handles = items.slice(startIndex, startIndex + recordsPerPage);

        return handles;

    }

    public async getAllHandleNames(search: HandleSearchModel, sort: string) {
        const handles = this.search(search);
        handles.sort((a, b) => (sort === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
        return handles.map((handle) => handle.name);
    }

    public async getHandleByName(handleName: string): Promise<IHandle | null> {
        const handleHex = HandleStore.getFromNameIndex(handleName);
        if (handleHex) {
            const handle = HandleStore.get(handleHex);
            if (handle) return handle;
        }

        return null;
    }

    public async getPersonalizedHandleByName(handleName: string): Promise<IPersonalizedHandle | null> {
        const handleHex = HandleStore.getFromNameIndex(handleName);
        if (handleHex) {
            const handle = HandleStore.get(handleHex);
            const personalization = HandleStore.getPersonalization(handleHex) ?? {};
            if (handle) {
                const personalizedHandle: IPersonalizedHandle = {
                    ...handle,
                    personalization
                };

                return personalizedHandle;
            }
        }

        return null;
    }

    public async getHolderAddressDetails(key: string): Promise<HolderAddressDetailsResponse> {
        const holderAddressDetails = HandleStore.holderAddressIndex.get(key);
        if (!holderAddressDetails) throw new HttpException(404, 'Not found');

        const { defaultHandle, manuallySet, hexes, knownOwnerName, type } = holderAddressDetails;

        return {
            total_handles: hexes.size,
            default_handle: defaultHandle,
            manually_set: manuallySet,
            address: key,
            known_owner_name: knownOwnerName,
            type
        };
    }

    public async getHandleDatumByName(handleName: string): Promise<string | null> {
        const handle = await this.getHandleByName(handleName);
        if (!handle) throw new HttpException(404, 'Not found');

        const { hex, utxo, hasDatum } = handle;

        if (!hasDatum) return null;

        const datum = await HandleStore.getDatumFromFileSystem({ handleHex: hex, utxo });
        if (datum) return datum;

        const result = await queryStateByUtxo(utxo);
        if (!result) {
            Logger.log({
                message: `${utxo} not found for handle ${handleName}`,
                category: LogCategory.ERROR,
                event: 'getHandleDatumByName.queryStateByUtxo.noResults'
            });
            throw new HttpException(500, 'Unable to query state');
        }

        const [_, txOut] = result[0];
        const txOutDatum = txOut.datum ?? null;

        // save file for quicker access next time
        await HandleStore.saveDatumFile({ handleHex: hex, utxo, datum: txOutDatum });
        return !txOutDatum || typeof txOutDatum === 'string' ? txOutDatum : JSON.stringify(txOutDatum);
    }

    public getHandleStats(): IHandleStats {
        return HandleStore.getMetrics();
    }

    public getIsCaughtUp(): boolean {
        return HandleStore.isCaughtUp();
    }
}

export default MemoryHandlesRepository;
