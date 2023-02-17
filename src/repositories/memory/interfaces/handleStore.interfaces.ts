import { IPersonalization, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';

export interface HandleHistory {
    old: Partial<IPersonalizedHandle> | null;
    new?: Partial<IPersonalizedHandle> | null;
}

export interface ISlotHistoryIndex {
    [handleHex: string]: HandleHistory;
}

export interface IHandleFileContent {
    slot: number;
    hash: string;
    schemaVersion?: number;
    handles: Record<string, IPersonalizedHandle>;
    history: [number, ISlotHistoryIndex][];
    orphanedPz: [string, IPersonalization][];
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
    utxo: string;
    background?: string;
    default_in_wallet?: string;
    profile_pic?: string;
    datum?: string;
    personalization?: IPersonalization;
}

export interface SaveWalletAddressMoveInput {
    slotNumber: number;
    hexName: string;
    adaAddress: string;
    utxo: string;
    datum?: string;
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
