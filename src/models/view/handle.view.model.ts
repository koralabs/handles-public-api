import { IHandle, Rarity } from '@koralabs/handles-public-api-interfaces';
import { HttpException } from '../../exceptions/HttpException';

export class HandleViewModel {
    hex: string;
    name: string;
    nft_image: string;
    original_nft_image: string;
    holder_address: string;
    length: number;
    og: number;
    rarity: Rarity;
    utxo: string;
    characters: string;
    numeric_modifiers: string;
    default_in_wallet: string;
    profile_pic: string;
    background: string;
    resolved_addresses: { ada: string; eth?: string | undefined; btc?: string | undefined };
    created_slot_number: number;
    updated_slot_number: number;
    hasDatum: boolean;

    constructor(handle: IHandle) {
        if (!handle.utxo) {
            throw new HttpException(400, 'Handle not found');
        }

        this.hex = handle.hex;
        this.name = handle.name;
        this.nft_image = handle.nft_image;
        this.original_nft_image = handle.original_nft_image;
        this.holder_address = handle.holder_address;
        this.length = handle.length;
        this.og = handle.og;
        this.rarity = handle.rarity;
        this.utxo = handle.utxo;
        this.characters = handle.characters;
        this.numeric_modifiers = handle.numeric_modifiers;
        this.default_in_wallet = handle.default_in_wallet;
        this.profile_pic = handle.profile_pic;
        this.background = handle.background;
        this.resolved_addresses = handle.resolved_addresses;
        this.created_slot_number = handle.created_slot_number;
        this.updated_slot_number = handle.updated_slot_number;
        this.hasDatum = handle.hasDatum;
    }
}
