import { IHandle } from '../../../interfaces/handle.interface';

export interface HandleFileContent {
    slot: number;
    hash: string;
    schemaVersion: number;
    handles: Record<string, IHandle>;
}

export interface HandleStoreMetrics {
    firstSlot?: number;
    lastSlot?: number;
    currentSlot?: number;
    elapsedOgmiosExec?: number;
    elapsedBuildingExec?: number;
    firstMemoryUsage?: number;
    currentBlockHash?: string;
    memorySize?: number;
}
