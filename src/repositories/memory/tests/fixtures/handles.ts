import { IHandle, Rarity } from '@koralabs/handles-public-api-interfaces';

export const handlesFixture: IHandle[] = [
    {
        hex: 'barbacoa-hex',
        name: 'barbacoa',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 8,
        og: 0,
        rarity: Rarity.basic,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
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
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 8,
        og: 0,
        rarity: Rarity.basic,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
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
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 4,
        og: 0,
        rarity: Rarity.common,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: 'taco',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now() + 20,
        updated_slot_number: Date.now() + 20
    }
];
