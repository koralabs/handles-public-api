import { Rarity } from '@koralabs/handles-public-api-interfaces';
import { ISlotHistoryIndex, HolderAddressIndex, Handle } from '../../interfaces/handleStore.interfaces';

export const handlesFixture: Handle[] = [
    {
        hex: 'barbacoa-hex',
        name: 'barbacoa',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 8,
        og_number: 0,
        utxo: 'utxo1#0',
        rarity: Rarity.basic,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: '123'
        },
        default_in_wallet: 'taco',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false,
        amount: 1,
        image_hash: '',
        standard_image_hash: '',
        svg_version: '1.0.0',
        holder_type: '',
        version: 0,
        default: false
    },
    {
        hex: 'burrito-hex',
        name: 'burrito',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 7,
        og_number: 0,
        utxo: 'utxo2#0',
        rarity: Rarity.common,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: '123'
        },
        default_in_wallet: 'taco',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now() + 10,
        updated_slot_number: Date.now() + 10,
        has_datum: false,
        amount: 1,
        image_hash: '',
        standard_image_hash: '',
        svg_version: '1.0.0',
        holder_type: '',
        version: 0,
        default: false
    },
    {
        hex: 'taco-hex',
        name: 'taco',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 4,
        og_number: 0,
        utxo: 'utxo3#0',
        rarity: Rarity.common,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: '123'
        },
        default_in_wallet: 'taco',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now() + 20,
        updated_slot_number: Date.now() + 20,
        has_datum: false,
        amount: 1,
        image_hash: '',
        standard_image_hash: '',
        svg_version: '1.0.0',
        holder_type: '',
        version: 0,
        default: true
    }
];

export const slotHistoryFixture: Record<number, ISlotHistoryIndex> = {
    0: {},
    1: {
        barbacoa: {
            old: null
        },
        burrito: {
            old: null
        },
        taco: {
            old: null
        }
    },
    2: {
        barbacoa: {
            old: { resolved_addresses: { ada: '123' } }
        }
    },
    3: {
        burrito: {
            old: { resolved_addresses: { ada: '123' } }
        }
    },
    4: {
        barbacoa: {
            old: { resolved_addresses: { ada: '456' } }
        }
    }
};
export const holdersFixture = new Map<string, HolderAddressIndex>([
    [
        'addr1',
        {
            handles: new Set(['']),
            defaultHandle: 'burritos',
            manuallySet: false,
            type: 'script',
            knownOwnerName: 'funnable.token'
        }
    ],
    [
        'addr2',
        {
            handles: new Set(['7461636F73', '66616A69746173']),
            defaultHandle: 'tacos',
            manuallySet: false,
            type: 'wallet',
            knownOwnerName: ''
        }
    ]
]);
