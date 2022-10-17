import { Request } from 'express';
import { IRegistry } from '../ioc';

export interface DataStoredInToken {
    id: string;
}

export interface Client {
    key: string;
    secret: string;
}

export interface TokenData {
    token: string;
    expiresIn: number;
}

export interface RequestWithClient extends Request {
    client?: Client;
}

export interface RequestWithRegistry {
    registry: IRegistry;
}
