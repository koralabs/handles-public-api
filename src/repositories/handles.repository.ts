import { ApiHandle, IHandleStats } from '@koralabs/kora-labs-common';
import { HolderAddressDetailsResponse } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import { HandleSearchModel } from '../models/HandleSearch.model';
import { HolderPaginationModel } from '../models/holderPagination.model';

interface IHandlesRepository {
    getAll: (params: { pagination: HandlePaginationModel; search: HandleSearchModel }) => Promise<{ searchTotal: number; handles: ApiHandle[] }>;
    getAllHandleNames(search: HandleSearchModel, sort: string): Promise<string[]>;
    getHandleByName: (handleName: string) => Promise<ApiHandle | null>;
    getHandleByHex: (handleHex: string) => Promise<ApiHandle | null>;
    getHolderAddressDetails: (key: string) => Promise<HolderAddressDetailsResponse>;
    getAllHolders: (params: { pagination: HolderPaginationModel }) => Promise<HolderAddressDetailsResponse[]>;
    getHandleStats: () => IHandleStats;
    getTotalHandlesStats: () => { total_handles: number; total_holders: number };
    currentHttpStatus: () => number;
    getHandleDatumByName: (handleName: string) => Promise<string | null>;
}

export default IHandlesRepository;
