import { IHandle } from '@koralabs/handles-public-api-interfaces';
import { IRegistry } from '../ioc';

export interface IGetAllQueryParams {
    records_per_page?: string;
    page?: string;
    sort?: 'asc' | 'desc';
    characters?: string;
    length?: string;
    rarity?: string;
    numeric_modifiers?: string;
    slot_number?: string;
    search?: string;
    holder_address?: string;
    og?: 'true' | 'false';
}

export interface IGetAllHoldersQueryParams {
    records_per_page?: string;
    page?: string;
    sort?: 'asc' | 'desc';
}

export interface IGetHandleRequest {
    registry: IRegistry;
    handle: string;
}

export interface IGetHolderAddressDetailsRequest {
    registry: IRegistry;
    address: string;
}

export interface HolderAddressDetailsResponse {
    total_handles: number;
    address: string;
    type: string;
    known_owner_name: string;
    default_handle: string;
    manually_set: boolean;
}
