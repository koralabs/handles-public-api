import { IRegistry } from '../ioc';

export enum Rarity {
    basic = 'basic', // - 8-15 characters
    common = 'common', // - 4-7 characters
    rare = 'rare', // - 3 characters
    ultra_rare = 'ultra_rare', // - 2 characters
    legendary = 'legendary' // - 1 character
}

export interface IPersonalization {
    my_page?: {
        type: string;
        domain?: string | null;
        customSettings?: string[] | null;
    };
    nft_appearance?: {
        image: string;
        background: string;
        profilePic: string;
        theme: string;
        contact?: string;
        textBackground: string;
        border: string;
        trimColor: string;
        selectedAttributes: string[];
        purchasedAttributes: string[];
    };
    social_links?: {
        twitter?: string;
        discord?: string;
        facebook?: string;
    };
    sub_handles?: {
        [subHandleName: string]: string; // walletId
    };
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
    default_in_wallet: string; // my_default_hndl
    profile_pic: string;
    background: string;
    resolved_addresses: {
        ada: string;
        eth?: string;
        btc?: string;
    };
    created_at: number;
    updated_at?: number;
}

export interface IPersonalizedHandle extends IHandle {
    personalization?: IPersonalization;
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
