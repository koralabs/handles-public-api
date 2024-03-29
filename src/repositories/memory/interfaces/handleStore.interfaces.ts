import { IPersonalization, IPersonalizedHandle, IHandleMetadata, IPzDatum, IReferenceToken, HandleType } from '@koralabs/kora-labs-common';

export interface StoredHandle extends IPersonalizedHandle {
    amount: number;
    type: HandleType;
    default?: boolean;
    resolved_addresses: {
        ada: string;
        [key: string]: string;
    };
}

export interface HandleHistory {
    old: Partial<StoredHandle> | null;
    new?: Partial<StoredHandle> | null;
}

export interface ISlotHistoryIndex {
    [handleHex: string]: HandleHistory;
}

export interface IHandleFileContent {
    slot: number;
    hash: string;
    schemaVersion?: number;
    handles: Record<string, StoredHandle>;
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
    last_update_address?: string;
    personalization?: IPersonalization;
    reference_token?: IReferenceToken;
    resolved_addresses?: Record<string, string>;
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
}

export interface HolderAddressIndex {
    handles: Set<string>;
    defaultHandle: string;
    manuallySet: boolean;
    type: string;
    knownOwnerName: string;
}
