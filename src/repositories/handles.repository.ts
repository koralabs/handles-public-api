import { IGetAllHandlesResults, IHandle, IHandleStats, IPersonalizedHandle } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import { HandleSearchModel } from '../models/HandleSearch.model';

interface IHandlesRepository {
    getAll: (params: {
        pagination: HandlePaginationModel;
        search: HandleSearchModel;
    }) => Promise<IGetAllHandlesResults>;
    getAllHandleNames(): Promise<string[]>;
    getHandleByName: (handleName: string) => Promise<IHandle>;
    getPersonalizedHandleByName: (handleName: string) => Promise<IPersonalizedHandle>;
    getHandleStats: () => IHandleStats;
    patchHandle: (handle: IPersonalizedHandle) => Promise<string>;
}

export default IHandlesRepository;
