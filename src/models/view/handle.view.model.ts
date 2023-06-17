import { IHandle, Rarity } from '@koralabs/handles-public-api-interfaces';
import { HttpException } from '../../exceptions/HttpException';

export class HandleViewModel {
    hex: string;
    name: string;
    image: string;
    standard_image: string;
    holder: string;
    length: number;
    og_number: number;
    rarity: Rarity;
    utxo: string;
    characters: string;
    numeric_modifiers: string;
    default_in_wallet: string;
    pfp_image: string;
    bg_image: string;
    resolved_addresses: { ada: string; eth?: string | undefined; btc?: string | undefined };
    created_slot_number: number;
    updated_slot_number: number;
    has_datum: boolean;
    image_hash: string;
    standard_image_hash: string;
    svg_version: string;

    constructor(handle: IHandle) {
        if (!handle.utxo) {
            throw new HttpException(404, 'Handle not found');
        }

        this.hex = handle.hex;
        this.name = handle.name;
        this.image = handle.image;
        this.standard_image = handle.standard_image;
        this.holder = handle.holder;
        this.length = handle.length;
        this.og_number = handle.og_number;
        this.rarity = handle.rarity;
        this.utxo = handle.utxo;
        this.characters = handle.characters;
        this.numeric_modifiers = handle.numeric_modifiers;
        this.default_in_wallet = handle.default_in_wallet;
        this.pfp_image = handle.pfp_image;
        this.bg_image = handle.bg_image;
        this.resolved_addresses = handle.resolved_addresses;
        this.created_slot_number = handle.created_slot_number;
        this.updated_slot_number = handle.updated_slot_number;
        this.has_datum = handle.has_datum;
        this.svg_version = handle.svg_version;
        this.image_hash = handle.image_hash.replace('0x', '');
        this.standard_image_hash = handle.standard_image_hash.replace('0x', '');
    }
}
