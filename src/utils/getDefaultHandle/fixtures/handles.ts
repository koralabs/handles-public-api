import { IHandle, Rarity } from '@koralabs/handles-public-api-interfaces';

export const ogHandles: IHandle[] = [
    {
        hex: 'og1-hex',
        name: 'og1',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 3,
        og: 123,
        utxo: 'og1-hex#0',
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
        updated_slot_number: Date.now(),
        hasDatum: false
    },
    {
        hex: 'og2-hex',
        name: 'og2',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 3,
        og: 124,
        utxo: 'og2-hex#0',
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
        updated_slot_number: Date.now(),
        hasDatum: false
    },
    {
        hex: 'og3-hex',
        name: 'og3',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 3,
        og: 125,
        utxo: 'og3-hex#0',
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
        updated_slot_number: Date.now(),
        hasDatum: false
    }
];

export const handlesWithDifferentLengths: IHandle[] = [
    {
        hex: '100-hex',
        name: '100',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 3,
        og: 0,
        utxo: '100-hex#0',
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
        updated_slot_number: Date.now(),
        hasDatum: false
    },
    {
        hex: '10-hex',
        name: '10',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        utxo: '10-hex#0',
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
        updated_slot_number: Date.now(),
        hasDatum: false
    },
    {
        hex: '1000-hex',
        name: '1000',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 4,
        og: 0,
        utxo: '1000-hex#0',
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
        updated_slot_number: Date.now(),
        hasDatum: false
    }
];

export const handlesWithDifferentSlotNumbers: IHandle[] = [
    {
        hex: '10-hex',
        name: '10',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        utxo: '10-hex#0',
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
        updated_slot_number: Date.now(),
        hasDatum: false
    },
    {
        hex: '11-hex',
        name: '11',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        utxo: '11-hex#0',
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
        updated_slot_number: Date.now() + 10,
        hasDatum: false
    },
    {
        hex: '12-hex',
        name: '12',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        utxo: '12-hex#0',
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
        updated_slot_number: Date.now() + 20,
        hasDatum: false
    }
];

export const handles: IHandle[] = [
    {
        hex: '11-hex',
        name: '11',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        utxo: '11-hex#0',
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
        updated_slot_number: Date.now(),
        hasDatum: false
    },
    {
        hex: '10-hex',
        name: '10',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        utxo: '10-hex#0',
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
        updated_slot_number: Date.now(),
        hasDatum: false
    },
    {
        hex: '12-hex',
        name: '12',
        holder_address: 'stake-key1',
        nft_image: '',
        original_nft_image: '',
        length: 2,
        og: 0,
        utxo: '12-hex#0',
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
        updated_slot_number: Date.now(),
        hasDatum: false
    }
];
