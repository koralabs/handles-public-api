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
    personalized?: boolean;
    og?: 'true' | 'false';
    handle_type?: string;
}

export type ISearchBody = string[];

export interface IGetAllHoldersQueryParams {
    records_per_page?: string;
    page?: string;
    sort?: 'asc' | 'desc';
}

export interface IGetHandleRequest {
    handle: string;
}

export interface IGetHolderAddressDetailsRequest {
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
