import { IHandle } from '@koralabs/handles-public-api-interfaces';
import { IRegistry } from '../ioc';

export interface IGetAllQueryParams {
    handles_per_page?: string;
    page?: string;
    sort?: 'asc' | 'desc';
    characters?: string;
    length?: string;
    rarity?: string;
    numeric_modifiers?: string;
    slot_number?: string;
    search?: string;
    stake_key?: string;
}

export interface IGetHandleRequest {
    registry: IRegistry;
    handle: string;
}

export interface IGetStakeKeyDetailsRequest {
    registry: IRegistry;
    key: string;
}

export interface StakeKeyDetailsResponse {
    handles: IHandle[];
    default_handle: string;
    manually_set: boolean;
}

export interface ISlotHistoryIndex {
    [handleHex: string]: { old: Partial<IHandle> | null; new: Partial<IHandle> };
}
