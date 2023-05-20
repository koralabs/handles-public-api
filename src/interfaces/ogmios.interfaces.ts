import { IPzDatum } from '@koralabs/handles-public-api-interfaces';

export enum MetadataLabel {
    'NFT' = 721,
    'HANDLE_PERSONALIZATION' = 5508
}

export interface HandleOnChainData {
    [policyId: string]: {
        [handleName: string]: HandleOnChainMetadata;
    };
}

export interface PersonalizationOnChainData {
    [policyId: string]: {
        [handleName: string]: IPzDatum;
    };
}

export interface BuildPersonalizationInput {
    personalizationDatum: IPzDatum;
    txId: string;
    index: number;
    lovelace: number;
    datumCbor: string;
}

export interface HandleOnChainMetadata {
    augmentations: Record<string, unknown>;
    core: {
        handleEncoding: string;
        og: boolean;
        og_number: number;
        prefix: string;
        termsofuse: string;
        version: number;
    };
    description: string;
    image: string;
    name: string;
    website: string;
}

export interface BlockTip {
    slot: number;
    hash: string;
    blockNo: number;
}
export interface TxMetadata {
    body: {
        blob?: {
            '721'?: {
                map: {
                    k: {
                        string: string; // policyId
                    };
                    v: {
                        [k: string]: unknown;
                    };
                }[];
            };
            '8413'?: {
                map: {
                    k: {
                        string: string; // policyId
                    };
                    v: {
                        [k: string]: unknown;
                    };
                }[];
            };
        };
    };
}

export interface TxOutput {
    address: string;
    value: {
        coins: number;
        assets?: {
            [policyIdDotHex: string]: number;
        };
    };
    datum?:
        | {
              [k: string]: unknown;
          }
        | string
        | null;
}

export interface TxBody {
    id: string;
    body: {
        outputs: TxOutput[];
        mint?: {
            coins: number;
            assets?: {
                [policyIdDotHex: string]: BigInt;
            };
        };
    };
    metadata?: TxMetadata;
}

export interface TxBlockBody {
    body: TxBody[];
    headerHash: string;
    header: {
        slot: number;
        blockHash: string;
    };
}

export interface TxBlock {
    shelley?: TxBlockBody;
    alonzo?: TxBlockBody;
    babbage?: TxBlock;
}

export interface HealthResponseBody {
    startTime: string;
    lastKnownTip: {
        slot: number;
        hash: string;
        blockNo: number;
    };
    lastTipUpdate: string;
    networkSynchronization: number;
    currentEra: string;
    metrics: {
        activeConnections: number;
        runtimeStats: {
            cpuTime: number;
            currentHeapSize: number;
            gcCpuTime: number;
            maxHeapSize: number;
        };
        sessionDurations: {
            max: number;
            mean: number;
            min: number;
        };
        totalConnections: number;
        totalMessages: number;
        totalUnrouted: number;
    };
    connectionStatus: string;
    currentEpoch: number;
    slotInEpoch: number;
}

export interface ProcessAssetTokenInput {
    assetName: string;
    slotNumber: number;
    address: string;
    utxo: string;
    lovelace: number;
    datum?: string;
    handleMetadata?: { [handleName: string]: HandleOnChainMetadata };
    isMintTx: boolean;
}
