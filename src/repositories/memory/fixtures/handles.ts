import { IHandle, Rarity } from '../../../interfaces/handle.interface';

export const handlesFixture: IHandle[] = [
    {
        hex: 'barbacoa-hex',
        name: 'barbacoa',
        nft_image: '',
        original_nft_image: '',
        length: 8,
        og: 0,
        rarity: Rarity.common,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: ''
    },
    {
        hex: 'burrito-hex',
        name: 'burrito',
        nft_image: '',
        original_nft_image: '',
        length: 7,
        og: 0,
        rarity: Rarity.basic,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: ''
    },
    {
        hex: 'taco-hex',
        name: 'taco',
        nft_image: '',
        original_nft_image: '',
        length: 4,
        og: 0,
        rarity: Rarity.rare,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: ''
        },
        default_in_wallet: '',
        profile_pic: '',
        background: ''
    }
];
