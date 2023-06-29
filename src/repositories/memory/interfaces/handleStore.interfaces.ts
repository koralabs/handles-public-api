import { IPersonalization, IPersonalizedHandle, IHandleMetadata } from '@koralabs/handles-public-api-interfaces';

export interface HandleHistory {
    old: Partial<Handle> | null;
    new?: Partial<Handle> | null;
}

export interface ISlotHistoryIndex {
    [handleHex: string]: HandleHistory;
}

export interface IHandleFileContent {
    slot: number;
    hash: string;
    schemaVersion?: number;
    handles: Record<string, Handle>;
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
    hex: string;
    name: string;
    adaAddress: string;
    og_number: number;
    image: string;
    image_hash?: string;
    slotNumber: number;
    utxo: string;
    svg_version?: string;
    bg_image?: string;
    default_in_wallet?: string;
    pfp_image?: string;
    datum?: string;
    personalization?: IPersonalization;
    amount?: number;
}

export interface SaveWalletAddressMoveInput {
    slotNumber: number;
    name: string;
    adaAddress: string;
    utxo: string;
    datum?: string;
}

export interface SavePersonalizationInput {
    slotNumber: number;
    hex: string;
    name: string;
    personalization: IPersonalization;
    addresses: {
        [chain: string]: string;
    };
    setDefault: boolean;
    customImage: string;
    customImageHash: string;
    standardImageHash: string;
    svgVersion: string;
    pfpImage?: string;
    bgImage?: string;
    metadata: IHandleMetadata;
}

export interface HolderAddressIndex {
    handles: Set<string>;
    defaultHandle: string;
    manuallySet: boolean;
    type: string;
    knownOwnerName: string;
}

export interface Handle extends IPersonalizedHandle {
    amount: number;
}
