import {
    IPersonalization,
    IPersonalizedHandle,
    IHandleMetadata,
    IPzDatum,
    IReferenceToken,
    HandleType
} from '@koralabs/kora-labs-common';

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
    tipBlockHash?: string;
    memorySize?: number;
    networkSync?: number;
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
    pfp_image?: string;
    datum?: string;
    script?: { type: string; cbor: string };
    personalization?: IPersonalization;
    reference_token?: IReferenceToken;
    amount?: number;
    version?: number;
    type: HandleType;
}

export interface SaveWalletAddressMoveInput {
    slotNumber: number;
    name: string;
    adaAddress: string;
    utxo: string;
    datum?: string;
    script?: { type: string; cbor: string };
}

export interface SavePersonalizationInput {
    slotNumber: number;
    hex: string;
    name: string;
    personalization: IPersonalization;
    reference_token: IReferenceToken;
    personalizationDatum: IPzDatum | null;
    metadata: IHandleMetadata | null;
    addresses: {
        [chain: string]: string;
    };
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
    type: HandleType;
    default?: boolean;
}
