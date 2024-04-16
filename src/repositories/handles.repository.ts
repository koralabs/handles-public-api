import { IHandleStats } from '@koralabs/kora-labs-common';
import { HolderAddressDetailsResponse } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import { HandleSearchModel } from '../models/HandleSearch.model';
import { HolderPaginationModel } from '../models/holderPagination.model';
import { StoredHandle, SubHandleSettings } from './memory/interfaces/handleStore.interfaces';

interface IHandlesRepository {
    getAll: (params: { pagination: HandlePaginationModel; search: HandleSearchModel }) => Promise<{ searchTotal: number; handles: StoredHandle[] }>;
    getAllHandleNames(search: HandleSearchModel, sort: string): Promise<string[]>;
    getHandleByName: (handleName: string) => Promise<StoredHandle | null>;
    getHandleByHex: (handleHex: string) => Promise<StoredHandle | null>;
    getHolderAddressDetails: (key: string) => Promise<HolderAddressDetailsResponse>;
    getAllHolders: (params: { pagination: HolderPaginationModel }) => Promise<HolderAddressDetailsResponse[]>;
    getHandleStats: () => IHandleStats;
    getTotalHandlesStats: () => { total_handles: number; total_holders: number };
    currentHttpStatus: () => number;
    getHandleDatumByName: (handleName: string) => Promise<string | null>;
    getSubHandleSettings: (handleName: string) => Promise<SubHandleSettings | null>;
    getSubHandles: (handleName: string) => Promise<StoredHandle[]>;
}

export default IHandlesRepository;
