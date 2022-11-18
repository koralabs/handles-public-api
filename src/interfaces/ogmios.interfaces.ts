export enum MetadataLabel {
    'NFT' = 721,
    'HANDLE_PERSONALIZATION' = 80085 // (.)(.)
}

export enum MetadatumAssetLabel {
    // TODO: Figure out hex labels
    REFERENCE_NFT = '0x000de140', // 100
    SUB_STANDARD_NFT = '0x000de140', // 222
    SUB_STANDARD_FT = '0x000de140'
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
