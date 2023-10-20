import { IHandle, IHandleStats, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';
import { HolderAddressDetailsResponse } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import { HandleSearchModel } from '../models/HandleSearch.model';
import { HolderPaginationModel } from '../models/holderPagination.model';

interface IHandlesRepository {
    getAll: (params: {
        pagination: HandlePaginationModel;
        search: HandleSearchModel;
    }) => Promise<{ searchTotal: number, handles: IPersonalizedHandle[]}>;
    getAllHandleNames(search: HandleSearchModel, sort: string): Promise<string[]>;
    getHandleByName: (handleName: string) => Promise<IPersonalizedHandle | null>;
    getHandleByHex: (handleHex: string) => Promise<IPersonalizedHandle | null>;
    getHolderAddressDetails: (key: string) => Promise<HolderAddressDetailsResponse>;
    getAllHolders: (params: { pagination: HolderPaginationModel }) => Promise<HolderAddressDetailsResponse[]>;
    getHandleStats: () => IHandleStats;
    getTotalHandlesStats: () => { total_handles: number; total_holders: number };
    getIsCaughtUp: () => boolean;
    getHandleDatumByName: (handleName: string) => Promise<string | null>;
}

export default IHandlesRepository;
