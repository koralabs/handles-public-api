import { IPersonalization, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';

export interface IHandleFileContent {
    slot: number;
    hash: string;
    schemaVersion?: number;
    handles: Record<string, IPersonalizedHandle>;
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
