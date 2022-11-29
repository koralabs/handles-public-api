import { IHandle } from '@koralabs/handles-public-api-interfaces';
import { IRegistry } from '../ioc';

export interface IGetAllQueryParams {
    limit?: string;
    cursor?: string;
    sort?: 'asc' | 'desc';
    characters?: string;
    length?: string;
    rarity?: string;
    numeric_modifiers?: string;
}

export interface IGetHandleRequest {
    registry: IRegistry;
    handle: string;
}

export interface IGetAllHandlesResults {
    handles: IHandle[];
    total: number;
    cursor?: string;
}
