import { IPersonalization, IPersonalizedHandle } from '../../../interfaces/handle.interface';

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
}

export interface SavePersonalizationInput {
    hexName: string;
    personalization: IPersonalization;
    addresses: {
        [chain: string]: string;
    };
}
