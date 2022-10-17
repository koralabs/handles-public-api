import { IHandle, Rarity } from '../interfaces/handle.interface';

export class HandleModel implements IHandle {
    hex: string;
    name: string;
    nft_image: string;
    original_nft_image: string;
    length: number;
    og: number;
    rarity: Rarity;
    characters: string;
    numeric_modifiers: string;
    resolved_addresses: { ada: string; eth?: string | undefined; btc?: string | undefined };
    personalization: Record<string, unknown>;

    constructor({
        hex,
        name,
        nft_image,
        original_nft_image,
        length,
        og,
        rarity,
        characters,
        numeric_modifiers,
        resolved_addresses,
        personalization
    }: IHandle) {
        this.hex = hex;
        this.name = name;
        this.nft_image = nft_image;
        this.original_nft_image = original_nft_image;
        this.length = length;
        this.og = og;
        this.rarity = rarity;
        this.characters = characters;
        this.numeric_modifiers = numeric_modifiers;
        this.resolved_addresses = resolved_addresses;
        this.personalization = personalization;
    }
}
