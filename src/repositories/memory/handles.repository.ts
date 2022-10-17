import { HttpException } from '../../exceptions/HttpException';

import { IGetAllHandlesResults, IHandle, IHandleStats } from '../../interfaces/handle.interface';
import { HandlePaginationModel } from '../../models/handlePagination.model';
import IHandlesRepository from '../handles.repository';
import { HandleStore } from './HandleStore';

class MemoryHandlesRepository implements IHandlesRepository {
    public async getAll(pagination: HandlePaginationModel): Promise<IGetAllHandlesResults> {
        const { cursor, sort } = pagination;
        const limitNumber = pagination.getLimitNumber();

        const array = Array.from(HandleStore.handles, ([_, value]) => ({ ...value } as IHandle));
        array.sort((a, b) => (sort === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));

        const nameIndex = cursor ? array.findIndex((a) => a.hex === cursor) : 0;
        const handles = array.slice(nameIndex, nameIndex + limitNumber);
        const nextCursor = array[nameIndex + limitNumber]?.hex;

        if (nextCursor) {
            return {
                cursor: nextCursor,
                handles
            };
        }

        return {
            handles
        };
    }

    public async getAllHandleNames() {
        const handles = Array.from(HandleStore.handles, ([_, value]) => ({ ...value } as IHandle));
        return handles.map((handle) => handle.name);
    }

    public async getHandleByName(handleName: string): Promise<IHandle> {
        const handleHex = HandleStore.nameIndex.get(handleName);
        if (handleHex) {
            const handle = HandleStore.get(handleHex);
            if (handle) return handle;
        }

        throw new HttpException(404, 'Not found');
    }

    public getHandleStats(): IHandleStats {
        return HandleStore.getMetrics();
    };
}

export default MemoryHandlesRepository;
