import { IHandle, IHandleStats, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';
import { HttpException } from '../../exceptions/HttpException';

import { HandlePaginationModel } from '../../models/handlePagination.model';
import { HandleSearchModel } from '../../models/HandleSearch.model';
import IHandlesRepository from '../handles.repository';
import { HandleStore } from './HandleStore';

class MemoryHandlesRepository implements IHandlesRepository {
    private search(search: HandleSearchModel) {
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

        const sortBySlot = ({ updated_slot_number: a }: IHandle, { updated_slot_number: b }: IHandle) =>
            sort === 'desc' ? b ?? 0 - a ?? 0 : a ?? 0 - b ?? 0;

        if (slotNumber) {
            items.sort(sortBySlot);
            const slotNumberIndex = items.findIndex((a) => a.updated_slot_number === slotNumber) ?? 0;
            const handles = items.slice(slotNumberIndex, slotNumberIndex + handlesPerPage);

            return handles;
        }

        items.sort((a, b) => (sort === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
        const startIndex = (page - 1) * handlesPerPage;
        const handles = items.slice(startIndex, startIndex + handlesPerPage);

        return handles;
    }

    public async getAllHandleNames(search: HandleSearchModel, sort: string) {
        const handles = this.search(search);
        handles.sort((a, b) => (sort === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
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

    public getIsCaughtUp(): boolean {
        return HandleStore.isCaughtUp();
    }
}

export default MemoryHandlesRepository;
