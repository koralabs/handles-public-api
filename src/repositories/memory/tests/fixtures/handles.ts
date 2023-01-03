import { IHandle, Rarity } from '@koralabs/handles-public-api-interfaces';
import { ISlotHistoryIndex } from '../../../../interfaces/handle.interface';

export const handlesFixture: IHandle[] = [
    {
        hex: 'barbacoa-hex',
        name: 'barbacoa',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 8,
        og: 0,
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
        updated_slot_number: Date.now()
    },
    {
        hex: 'burrito-hex',
        name: 'burritos',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 8,
        og: 0,
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
        updated_slot_number: Date.now() + 10
    },
    {
        hex: 'taco-hex',
        name: 'taco',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 4,
        og: 0,
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
        updated_slot_number: Date.now() + 20
    }
];

export const slotHistoryFixture: Record<number, ISlotHistoryIndex> = {
    0: {},
    1: {
        'barbacoa-hex': {
            old: null,
            new: {
                resolved_addresses: { ada: handlesFixture[0].resolved_addresses.ada }
            }
        },
        'burrito-hex': {
            old: null,
            new: {
                resolved_addresses: { ada: handlesFixture[1].resolved_addresses.ada }
            }
        },
        'taco-hex': {
            old: null,
            new: {
                resolved_addresses: { ada: handlesFixture[2].resolved_addresses.ada }
            }
        }
    },
    2: {
        'barbacoa-hex': {
            old: { resolved_addresses: { ada: '123' } },
            new: { resolved_addresses: { ada: '456' } }
        }
    },
    3: {
        'burrito-hex': {
            old: { resolved_addresses: { ada: '123' } },
            new: { resolved_addresses: { ada: '456' } }
        }
    },
    4: {
        'barbacoa-hex': {
            old: { resolved_addresses: { ada: '456' } },
            new: { resolved_addresses: { ada: '789' } }
        }
    }
};
