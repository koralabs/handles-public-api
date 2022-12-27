import { IHandle, Rarity } from '@koralabs/handles-public-api-interfaces';

export const ogHandles: IHandle[] = [
    {
        hex: 'og1-hex',
        name: 'og1',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 3,
        og: 123,
        rarity: Rarity.common,
        characters: 'letters,numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now()
    },
    {
        hex: 'og2-hex',
        name: 'og2',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 3,
        og: 124,
        rarity: Rarity.common,
        characters: 'letters,numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now()
    },
    {
        hex: 'og3-hex',
        name: 'og3',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 3,
        og: 125,
        rarity: Rarity.common,
        characters: 'letters,numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now()
    }
];

export const handlesWithDifferentLengths: IHandle[] = [
    {
        hex: '100-hex',
        name: '100',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 3,
        og: 0,
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now()
    },
    {
        hex: '10-hex',
        name: '10',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        rarity: Rarity.ultra_rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now()
    },
    {
        hex: '1000-hex',
        name: '1000',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 4,
        og: 0,
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now()
    }
];

export const handlesWithDifferentSlotNumbers: IHandle[] = [
    {
        hex: '10-hex',
        name: '10',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now()
    },
    {
        hex: '11-hex',
        name: '11',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        rarity: Rarity.ultra_rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now() + 10,
        updated_slot_number: Date.now() + 10
    },
    {
        hex: '12-hex',
        name: '12',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now() + 20,
        updated_slot_number: Date.now() + 20
    }
];

export const handles: IHandle[] = [
    {
        hex: '11-hex',
        name: '11',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        rarity: Rarity.ultra_rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now()
    },
    {
        hex: '10-hex',
        name: '10',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now()
    },
    {
        hex: '12-hex',
        name: '12',
        stake_key: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now()
    }
];
