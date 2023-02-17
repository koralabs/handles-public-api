import { IHandle, Rarity } from '@koralabs/handles-public-api-interfaces';
import { MetadatumAssetLabel } from '../../../../interfaces/ogmios.interfaces';
import { ISlotHistoryIndex, HolderAddressIndex } from '../../interfaces/handleStore.interfaces';

export const handlesFixture: IHandle[] = [
    {
        hex: 'barbacoa-hex',
        name: 'barbacoa',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 8,
        og: 0,
        utxo: 'utxo1#0',
        rarity: Rarity.basic,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: '123'
        },
        default_in_wallet: 'taco',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        hasDatum: false
    },
    {
        hex: 'burrito-hex',
        name: 'burritos',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 8,
        og: 0,
        utxo: 'utxo2#0',
        rarity: Rarity.basic,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: '123'
        },
        default_in_wallet: 'taco',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now() + 10,
        updated_slot_number: Date.now() + 10,
        hasDatum: false
    },
    {
        hex: 'taco-hex',
        name: 'taco',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 4,
        og: 0,
        utxo: 'utxo3#0',
        rarity: Rarity.common,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: '123'
        },
        default_in_wallet: 'taco',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now() + 20,
        updated_slot_number: Date.now() + 20,
        hasDatum: false
    }
];

export const slotHistoryFixture: Record<number, ISlotHistoryIndex> = {
    0: {},
    1: {
        'barbacoa-hex': {
            old: null
        },
        'burrito-hex': {
            old: null
        },
        'taco-hex': {
            old: null
        }
    },
    2: {
        'barbacoa-hex': {
            old: { resolved_addresses: { ada: '123' } }
        },
        [`${MetadatumAssetLabel.REFERENCE_NFT}taco-hex`]: {
            old: null
        }
    },
    3: {
        'burrito-hex': {
            old: { resolved_addresses: { ada: '123' } }
        },
        [`${MetadatumAssetLabel.REFERENCE_NFT}taco-hex`]: {
            old: { personalization: { nft_appearance: { handleTextShadowColor: '#fff' } } }
        }
    },
    4: {
        'barbacoa-hex': {
            old: { resolved_addresses: { ada: '456' } }
        },
        [`${MetadatumAssetLabel.REFERENCE_NFT}taco-hex`]: {
            old: { personalization: { nft_appearance: { handleTextShadowColor: '#000' } } }
        }
    }
};
export const holdersFixture = new Map<string, HolderAddressIndex>([
    [
        'addr1',
        {
            hexes: new Set(['']),
            defaultHandle: 'burritos',
            manuallySet: false,
            type: 'script',
            knownOwnerName: 'funnable.token'
        }
    ],
    [
        'addr2',
        {
            hexes: new Set(['7461636F73', '66616A69746173']),
            defaultHandle: 'tacos',
            manuallySet: false,
            type: 'wallet',
            knownOwnerName: ''
        }
    ]
]);
