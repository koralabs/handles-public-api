import { IHandle, IHandleStats, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';
import { IGetAllHandlesResults } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import { HandleSearchModel } from '../models/HandleSearch.model';

interface IHandlesRepository {
    getAll: (params: {
        pagination: HandlePaginationModel;
        search: HandleSearchModel;
    }) => Promise<IGetAllHandlesResults>;
    getAllHandleNames(search: HandleSearchModel, sort: string): Promise<string[]>;
    getHandleByName: (handleName: string) => Promise<IHandle>;
    getPersonalizedHandleByName: (handleName: string) => Promise<IPersonalizedHandle>;
    getHandleStats: () => IHandleStats;
    getIsCaughtUp: () => boolean;
}

export default IHandlesRepository;
