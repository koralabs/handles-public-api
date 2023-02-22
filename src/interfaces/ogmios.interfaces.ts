export enum MetadataLabel {
    'NFT' = 721,
    'HANDLE_PERSONALIZATION' = 5508
}

/**
 * The asset label is a string that is used to identify the asset type.
 * First, remove the first and last 0.
 * Next, use the first 4 characters as the hex and convert to decimal. https://www.rapidtables.com/convert/number/hex-to-decimal.html
 * Finally, use the decimal number and convert to CRC8. It should match the last 2 characters. https://crccalc.com/
 */
export enum MetadatumAssetLabel {
    REFERENCE_NFT = '000643b0', // 100
    SUB_STANDARD_NFT = '000de140', // 222
    SUB_STANDARD_FT = '0014df10' // 333
}

export interface HandleOnChainData {
    [policyId: string]: {
        [handleName: string]: HandleOnChainMetadata;
    };
}

export interface PersonalizationOnChainData {
    [policyId: string]: {
        [handleName: string]: PersonalizationOnChainMetadata;
    };
}

export interface PersonalizationOnChainMetadata {
    personalizedHandle: string; // 'ipfs://<personalizedHandleHash>'
    nftImage: string; // 'ipfs://<nftHash>'
    originalNftImage: string; // 'ipfs://<nftHash>'
    profilePic: string; // 'ipfs://<nftHash>'
    background: string; // 'ipfs://<nftHash>'
    additionalHandleSettings: string; // 'ipfs://<additionalHandleSettingsHash>'
    socialContactInfo: string; // 'ipfs://<socialContactInfoHash>'
    personalContactInfo: string; // 'ipfs://<personalContactInformationHash>'
    version: string;
    darkMode: boolean;
    default: boolean;
}

export interface HandleOnChainMetadata {
    augmentations: Record<string, unknown>;
    core: {
        handleEncoding: string;
        og: number;
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
                [policyIdDotHex: string]: number;
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
    datum?: string;
    handleMetadata?: { [handleName: string]: HandleOnChainMetadata };
    isMintTx: boolean;
}
