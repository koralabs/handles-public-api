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