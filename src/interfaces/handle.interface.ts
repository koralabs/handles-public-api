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
}

export interface IGetHandleRequest {
    registry: IRegistry;
    handle: string;
}
