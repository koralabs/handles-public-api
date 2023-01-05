import { IHandle, IPersonalization, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';

export interface HandleHistory {
    old: Partial<IHandle> | null;
    new: Partial<IHandle>;
}

export interface ISlotHistoryIndex {
    [handleHex: string]: HandleHistory;
}

export interface IHandleFileContent {
    slot: number;
    hash: string;
    schemaVersion?: number;
    handles: Record<string, IPersonalizedHandle>;
}

export interface IHandleHistoryFileContent {
    slot: number;
    hash: string;
    schemaVersion?: number;
    history: [number, ISlotHistoryIndex][];
}

export interface IHandleStoreMetrics {
    firstSlot?: number;
    lastSlot?: number;
    currentSlot?: number;
    elapsedOgmiosExec?: number;
    elapsedBuildingExec?: number;
    firstMemoryUsage?: number;
    currentBlockHash?: string;
    memorySize?: number;
}

export interface SaveMintingTxInput {
    hexName: string;
    name: string;
    adaAddress: string;
    og: number;
    image: string;
    slotNumber: number;
    background?: string;
    default_in_wallet?: string;
    profile_pic?: string;
}

export interface SaveWalletAddressMoveInput {
    slotNumber: number;
    hexName: string;
    adaAddress: string;
}

export interface SavePersonalizationInput {
    slotNumber: number;
    hexName: string;
    personalization: IPersonalization;
    addresses: {
        [chain: string]: string;
    };
}

export interface HolderAddressIndex {
    hexes: Set<string>;
    defaultHandle: string;
    manuallySet: boolean;
    type: string;
    knownOwnerName: string;
}
