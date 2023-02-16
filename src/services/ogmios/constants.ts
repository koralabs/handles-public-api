export interface Point {
    slot: number;
    hash: string;
}

export interface EraBoundaries {
    [network: string]: Point;
}

export interface PolicyIds {
    [network: string]: string[];
}

export const handleEraBoundaries: EraBoundaries = {
    mainnet: {
        slot: 47931333,
        hash: '847543d30b99cbb288bee3064f83ff50140cf944ce60fa5d356f27611e94b1f0'
    },
    testnet: {
        slot: 42971872,
        hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6'
    },
    preprod: {
        slot: 0,
        hash: ''
    },
    preview: {
        slot: 0,
        hash: ''
    }
};

export const POLICY_IDS: PolicyIds = {
    mainnet: ['f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a'],
    testnet: ['8d18d786e92776c824607fd8e193ec535c79dc61ea2405ddf3b09fe3'],
    preprod: [
        'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a',
        '5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6'
    ],
    preview: ['f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a']
};

export enum ERROR_TEXT {
    HANDLE_LIMIT_EXCEEDED = "'records_per_page' must be a number",
    HANDLE_LIMIT_INVALID_FORMAT = "'records_per_page' can't be more than 1000",
    HANDLE_SORT_INVALID = "'sort' must be 'desc' or 'asc'",
    HANDLE_PAGE_INVALID = "'page' must be a number",
    HANDLE_SLOT_NUMBER_INVALID = "'slot_number' must be a number",
    HANDLE_PAGE_AND_SLOT_NUMBER_INVALID = "'page' and 'slot_number' can't be used together"
}

export const HANDLES_PER_PAGE_MAX = 1000;
