import { IHandle, IHandleStats, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';
import { HttpException } from '../../exceptions/HttpException';

import { IGetAllHandlesResults } from '../../interfaces/handle.interface';
import { HandlePaginationModel } from '../../models/handlePagination.model';
import { HandleSearchModel } from '../../models/HandleSearch.model';
import IHandlesRepository from '../handles.repository';
import { HandleStore } from './HandleStore';

class MemoryHandlesRepository implements IHandlesRepository {
    private search(search: HandleSearchModel, sort: string) {
        const { characters, length, rarity, numeric_modifiers } = search;

        const getHashes = (index: Map<string, Set<string>>, key: string | undefined) =>
            Array.from(index.get(key ?? '') ?? [], (value) => value);

        const characterArray = getHashes(HandleStore.charactersIndex, characters);
        const lengthArray = getHashes(HandleStore.lengthIndex, length);
        const rarityArray = getHashes(HandleStore.rarityIndex, rarity);
        const numericModifiersArray = getHashes(HandleStore.numericModifiersIndex, numeric_modifiers);

        const filteredArrays = [characterArray, lengthArray, rarityArray, numericModifiersArray].filter(
            (a) => a.length
        );

        const handleHexes = filteredArrays.length
            ? filteredArrays.reduce((a, b) => a.filter((c) => b.includes(c)))
            : [];

        const uniqueHexes = [...new Set(handleHexes)];

        const array =
            characters || length || rarity || numeric_modifiers
                ? uniqueHexes.reduce<IHandle[]>((agg, hex) => {
                      const handle = HandleStore.handles.get(hex);
                      if (handle) agg.push(handle);
                      return agg;
                  }, [])
                : Array.from(HandleStore.handles, ([_, value]) => ({ ...value } as IHandle));

        array.sort((a, b) => (sort === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));

        return array;
    }

    public async getAll({
        pagination,
        search
    }: {
        pagination: HandlePaginationModel;
        search: HandleSearchModel;
    }): Promise<IGetAllHandlesResults> {
        const { cursor, sort } = pagination;
        const limitNumber = pagination.getLimitNumber();

        const items = this.search(search, sort);

        const nameIndex = cursor ? items.findIndex((a) => a.hex === cursor) : 0;
        const handles = items.slice(nameIndex, nameIndex + limitNumber);
        const nextCursor = items[nameIndex + limitNumber]?.hex;

        const result = {
            total: items.length,
            handles
        };

        if (nextCursor) {
            return {
                ...result,
                cursor: nextCursor
            };
        }

        return result;
    }

    public async getAllHandleNames(search: HandleSearchModel, sort: string) {
        const handles = this.search(search, sort);
        return handles.map((handle) => handle.name);
    }

    public async getHandleByName(handleName: string): Promise<IHandle> {
        const handleHex = HandleStore.getFromNameIndex(handleName);
        if (handleHex) {
            const handle = HandleStore.get(handleHex);
            if (handle) return handle;
        }

        throw new HttpException(404, 'Not found');
    }

    public async getPersonalizedHandleByName(handleName: string): Promise<IPersonalizedHandle> {
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

        throw new HttpException(404, 'Not found');
    }

    public getHandleStats(): IHandleStats {
        return HandleStore.getMetrics();
    }
}

export default MemoryHandlesRepository;
