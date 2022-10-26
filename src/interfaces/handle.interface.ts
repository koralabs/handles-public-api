import { IRegistry } from '../ioc';

export enum Rarity {
    basic = 'basic', // - 8-15 characters
    common = 'common', // - 4-7 characters
    rare = 'rare', // - 3 characters
    ultra_rare = 'ultra_rare', // - 2 characters
    legendary = 'legendary' // - 1 character
}

export interface IHandle {
    hex: string;
    name: string;
    nft_image: string;
    original_nft_image: string;
    length: number;
    og: number;
    rarity: Rarity;
    characters: string; // 'letters,numbers,special',
    numeric_modifiers: string; // 'negative,decimal',
    resolved_addresses: {
        ada: string;
        eth?: string;
        btc?: string;
    };
    personalization: Record<string, unknown>;
}

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

export interface IHandleStats {
    percentageComplete: string;
    currentMemoryUsed: number;
    ogmiosElapsed: string;
    buildingElapsed: string;
    handleCount: number;
    slotDate: Date;
    memorySize: number;
    currentSlot: number;
    currentBlockHash: string;
}
