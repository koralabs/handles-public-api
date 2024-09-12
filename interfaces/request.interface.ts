import { Sort } from '@koralabs/kora-labs-common';

export interface IGetAllQueryParams {
    records_per_page?: string;
    page?: string;
    sort?: Sort;
    characters?: string;
    length?: string;
    rarity?: string;
    numeric_modifiers?: string;
    slot_number?: string;
    search?: string;
    holder_address?: string;
    personalized?: boolean;
    og?: 'true' | 'false';
    handle_type?: string;
    type: string;
}

export type ISearchBody = string[];

export interface IGetAllHoldersQueryParams {
    records_per_page?: string;
    page?: string;
    sort?: Sort;
}

export interface IGetHandleRequest {
    handle: string;
}

export interface IGetHolderAddressDetailsRequest {
    address: string;
}
