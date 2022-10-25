import { ModelException } from '../exceptions/ModelException';
import { Rarity } from '../interfaces/handle.interface';
import { isNumeric } from '../utils/util';

export class HandleSearchModel {
    private _characters?: string;
    private _length?: string;
    private _rarity?: string;
    private _numeric_modifiers?: string;

    constructor(characters?: string, length?: string, rarity?: string, numeric_modifiers?: string) {
        this.characters = characters;
        this.length = length;
        this.rarity = rarity;
        this.numeric_modifiers = numeric_modifiers;
    }

    get characters() {
        return this._characters;
    }

    set characters(value) {
        const validCharacters = ['letters', 'numbers', 'special'];
        if (value && !validCharacters.some((v) => value.split(',').includes(v))) {
            throw new ModelException(`characters must be ${validCharacters.join(', ')}`);
        }

        this._characters = value;
    }

    get rarity() {
        return this._rarity;
    }

    set rarity(value) {
        const validRarity = Object.values(Rarity);
        if (value && !validRarity.some((v) => value.split(',').includes(v))) {
            throw new ModelException(`characters must be ${validRarity.join(', ')}`);
        }
        this._rarity = value;
    }

    get length() {
        return this._length;
    }

    set length(value) {
        if (value && !isNumeric(value)) {
            throw new ModelException('Length must be a number');
        }

        if (value && parseInt(value) > 15) {
            throw new ModelException('Length exceeded');
        }

        this._length = value;
    }

    get numeric_modifiers() {
        return this._numeric_modifiers;
    }

    set numeric_modifiers(value) {
        const validModifiers = ['negative', 'decimal'];
        if (value && !validModifiers.some((v) => value.split(',').includes(v))) {
            throw new ModelException(`numeric_modifiers must be ${validModifiers.join(', ')}`);
        }

        this._numeric_modifiers = value;
    }
}
