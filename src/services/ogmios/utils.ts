import { OGMIOS_ENDPOINT } from '../../config';
import fetch from 'cross-fetch';
import { LogCategory, Logger } from '../../utils/logger';
import { Rarity } from '@koralabs/handles-public-api-interfaces';

const parseCborObject = (value: any) => {
    const lastKey = Object.keys(value).pop();
    let objString = '';
    if (typeof value === 'object') {
        // We add the first curly brace
        objString += '{';
        for (const key in value) {
            if (key === 'map') {
                for (let i = 0; i < value[key].length; i++) {
                    const { k, v } = value[key][i];

                    if (v.map) {
                        objString += `"${k.string}":${parseCborObject(v)}`;
                    } else {
                        objString += `"${k.string}":${parseCborObject(v.string ?? v.int ?? v.list ?? '')}`;
                    }

                    // We add the comma
                    if (value[key].length !== i + 1) {
                        objString += ',';
                    }
                }
            } else {
                objString += `"${key}":${parseCborObject(value[key])}`;
            }

            // We add the comma
            if (key !== lastKey) {
                objString += ',';
            }
        }
        // We add the last curly brace
        objString += '}';
    } else if (typeof value === 'string') {
        objString += `"${value}"`;
    } else if (typeof value === 'number') {
        objString += `${value}`;
    } else if (typeof value === 'bigint') {
        objString += `${Number(value)}`;
    }
    return objString;
};

/**
 *
 * expecting cbor metadata after 721 or some other label
 *
 * @param metadata
 * @returns parsed metadata
 */
export const buildOnChainObject = <T>(cborData: any): T | null => {
    try {
        const stringifiedMetadata = parseCborObject(cborData);
        return JSON.parse(stringifiedMetadata) as T;
    } catch (error) {
        console.log('Error building metadata', error);
        throw error;
    }
};

export const hex2String = (hex: string) => {
    var hexString = hex.toString(); //force conversion
    var str = '';
    for (var i = 0; i < hexString.length; i += 2) str += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
    return str;
};

export const buildCharacters = (name: string): string => {
    const characters: string[] = [];

    if (/[a-z]+/.test(name)) {
        characters.push('letters');
    }

    if (/[0-9]+/.test(name)) {
        characters.push('numbers');
    }

    if (/[_\-\.]+/.test(name)) {
        characters.push('special');
    }

    return characters.join(',');
};

export const buildNumericModifiers = (name: string): string => {
    const modifiers: string[] = [];

    if (/^-?[0-9]\d*(\.\d+)?$/.test(name)) {
        if (name.startsWith('-')) {
            modifiers.push('negative');
        }

        if (name.includes('.')) {
            modifiers.push('decimal');
        }
    }

    return modifiers.join(',');
};

export const getRarity = (name: string): Rarity => {
    const length = name.length;
    if (1 === length) {
        return Rarity.legendary;
    }

    if (2 === length) {
        return Rarity.ultra_rare;
    }

    if (3 === length) {
        return Rarity.rare;
    }

    if (length > 3 && length < 8) {
        return Rarity.common;
    }

    return Rarity.basic;
};

export const stringifyBlock = (metadata: any) =>
    JSON.stringify(metadata, (k, v) => (typeof v === 'bigint' ? v.toString() : v));

export const fetchHealth = async () => {
    let ogmiosResults = null;
    try {
        const ogmiosResponse = await fetch(`${OGMIOS_ENDPOINT}/health`);
        ogmiosResults = await ogmiosResponse.json();
    } catch (error: any) {
        Logger.log(error.message, LogCategory.ERROR);
    }
    return ogmiosResults;
};
