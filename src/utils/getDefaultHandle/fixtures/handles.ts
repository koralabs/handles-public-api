import { IHandle, Rarity } from '@koralabs/handles-public-api-interfaces';

export const ogHandles: IHandle[] = [
    {
        hex: 'og1-hex',
        name: 'og1',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 3,
        og_number: 123,
        utxo: 'og1-hex#0',
        rarity: Rarity.common,
        characters: 'letters,numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false
    },
    {
        hex: 'og2-hex',
        name: 'og2',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 3,
        og_number: 124,
        utxo: 'og2-hex#0',
        rarity: Rarity.common,
        characters: 'letters,numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false
    },
    {
        hex: 'og3-hex',
        name: 'og3',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 3,
        og_number: 125,
        utxo: 'og3-hex#0',
        rarity: Rarity.common,
        characters: 'letters,numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false
    }
];

export const handlesWithDifferentLengths: IHandle[] = [
    {
        hex: '100-hex',
        name: '100',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 3,
        og_number: 0,
        utxo: '100-hex#0',
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false
    },
    {
        hex: '10-hex',
        name: '10',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 2,
        og_number: 0,
        utxo: '10-hex#0',
        rarity: Rarity.ultra_rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false
    },
    {
        hex: '1000-hex',
        name: '1000',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 4,
        og_number: 0,
        utxo: '1000-hex#0',
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false
    }
];

export const handlesWithDifferentSlotNumbers: IHandle[] = [
    {
        hex: '10-hex',
        name: '10',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 2,
        og_number: 0,
        utxo: '10-hex#0',
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false
    },
    {
        hex: '11-hex',
        name: '11',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 2,
        og_number: 0,
        utxo: '11-hex#0',
        rarity: Rarity.ultra_rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now() + 10,
        updated_slot_number: Date.now() + 10,
        has_datum: false
    },
    {
        hex: '12-hex',
        name: '12',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 2,
        og_number: 0,
        utxo: '12-hex#0',
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now() + 20,
        updated_slot_number: Date.now() + 20,
        has_datum: false
    }
];

export const handles: IHandle[] = [
    {
        hex: '11-hex',
        name: '11',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 2,
        og_number: 0,
        utxo: '11-hex#0',
        rarity: Rarity.ultra_rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false
    },
    {
        hex: '10-hex',
        name: '10',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 2,
        og_number: 0,
        utxo: '10-hex#0',
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false
    },
    {
        hex: '12-hex',
        name: '12',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 2,
        og_number: 0,
        utxo: '12-hex#0',
        rarity: Rarity.rare,
        characters: 'numbers',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false
    }
];
