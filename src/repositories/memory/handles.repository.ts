import fs from 'fs';

import { NODE_ENV } from '../../config';
import { HttpException } from '../../exceptions/HttpException';

import { IGetAllHandlesResults, IHandle, IHandleStats, IPersonalizedHandle } from '../../interfaces/handle.interface';
import { HandlePaginationModel } from '../../models/handlePagination.model';
import { HandleSearchModel } from '../../models/HandleSearch.model';
import IHandlesRepository from '../handles.repository';
import { HandleStore } from './HandleStore';

class MemoryHandlesRepository implements IHandlesRepository {
    public async getAll({
        pagination,
        search
    }: {
        pagination: HandlePaginationModel;
        search: HandleSearchModel;
    }): Promise<IGetAllHandlesResults> {
        const { cursor, sort } = pagination;
        const limitNumber = pagination.getLimitNumber();

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

        const nameIndex = cursor ? array.findIndex((a) => a.hex === cursor) : 0;
        const handles = array.slice(nameIndex, nameIndex + limitNumber);
        const nextCursor = array[nameIndex + limitNumber]?.hex;

        const result = {
            total: array.length,
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

    public async getAllHandleNames() {
        const handles = HandleStore.getHandles();
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

    public async patchHandle(handle: IPersonalizedHandle): Promise<string> {
        if (NODE_ENV === 'local') {
            fs.writeFileSync('storage/local.json', JSON.stringify(handle));
            return JSON.stringify(handle);
        }

        // TODO: this needs to craft a transaction
        throw new HttpException(500, 'Not implemented');
    }
}

export default MemoryHandlesRepository;
