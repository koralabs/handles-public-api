import { IHandle, IHandleStats, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';
import { HolderAddressDetailsResponse } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import { HandleSearchModel } from '../models/HandleSearch.model';

interface IHandlesRepository {
    getAll: (params: { pagination: HandlePaginationModel; search: HandleSearchModel }) => Promise<IHandle[]>;
    getAllHandleNames(search: HandleSearchModel, sort: string): Promise<string[]>;
    getHandleByName: (handleName: string) => Promise<IHandle>;
    getPersonalizedHandleByName: (handleName: string) => Promise<IPersonalizedHandle>;
    getHolderAddressDetails: (key: string) => Promise<HolderAddressDetailsResponse>;
    getHandleStats: () => IHandleStats;
    getIsCaughtUp: () => boolean;
}

export default IHandlesRepository;
