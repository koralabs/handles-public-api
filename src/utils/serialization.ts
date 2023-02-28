import { Logger } from '@koralabs/kora-labs-common';
import { bech32 } from 'bech32';
import cbor from 'borc';

export enum AddressType {
    Wallet = 'wallet',
    Enterprise = 'enterprise',
    Script = 'script',
    Reward = 'reward',
    Other = 'other'
}

export enum StakeAddressType {
    Script = 'f1',
    Key = 'e1'
}

export const getPaymentAddressType = (headerByte: number): AddressType => {
    // https://cips.cardano.org/cips/cip19/#shelleyaddresses
    if (headerByte >= 8) {
        return AddressType.Other;
    } else if (headerByte === 6) {
        return AddressType.Enterprise;
    } else if (headerByte % 2 === 0) {
        return AddressType.Wallet;
    } else {
        return AddressType.Script;
    }
};

export const decodeAddress = (address: string): string | null => {
    try {
        const addressWords = bech32.decode(address, 104);
        const payload = bech32.fromWords(addressWords.words);
        const addressDecoded = `${Buffer.from(payload).toString('hex')}`;
        return addressDecoded;
    } catch (error) {
        return null;
    }
};

const getDelegationAddressType = (headerByte: number): StakeAddressType => {
    if (headerByte === 2 || headerByte === 3) {
        return StakeAddressType.Script;
    }

    return StakeAddressType.Key;
};

export const buildPaymentAddressType = (address: string): AddressType => {
    const decoded = decodeAddress(address);
    if (!decoded) {
        return AddressType.Other;
    }

    const [c] = decoded;
    const parsedChar = parseInt(c);

    if (isNaN(parsedChar)) {
        if (['e', 'f'.includes(c)]) {
            return AddressType.Reward;
        } else {
            return AddressType.Other;
        }
    }

    const addressType = getPaymentAddressType(parsedChar);
    return addressType;
};

export const buildStakeKey = (address: string): string | null => {
    try {
        const decoded = decodeAddress(address);
        if (!decoded || decoded.length !== 114) return null;

        const [c] = decoded;
        const parsedChar = parseInt(c);

        const delegationType = getDelegationAddressType(parsedChar);

        // stake part of the address is the last 56 bytes
        const stakeAddressDecoded = delegationType + decoded.substr(decoded.length - 56);
        const stakeAddress = bech32.encode(
            'stake',
            bech32.toWords(Uint8Array.from(Buffer.from(stakeAddressDecoded, 'hex'))),
            104
        );

        return stakeAddress;
    } catch (error: any) {
        Logger.log(`Error building stake key ${error.message}`);
        return null;
    }
};

const buildJsonFromMap = (map: Map<string, unknown>): Record<string, unknown> => {
    let newObj: Record<string, unknown> = {};
    for (let [k, v] of map) {
        if (v instanceof Map) {
            newObj[k] = buildJsonFromMap(v);
        } else if (Array.isArray(v)) {
            newObj[k] = v.map((v: any) => {
                if (v instanceof Map) {
                    return buildJsonFromMap(v);
                }
                return v;
            });
        } else if (v instanceof Buffer) {
            newObj[k] = v.toString();
        } else {
            newObj[k] = v;
        }
    }
    return newObj;
};

const buildJsonFromArray = (array: unknown[]): unknown[] => {
    const newArray: unknown[] = [];
    for (let i = 0; i < array.length; i++) {
        let element = array[i];
        if (element instanceof Buffer) {
            element = element.toString();
        }
        if (element instanceof Map) {
            newArray.push(buildJsonFromMap(element));
        } else if (Array.isArray(element)) {
            newArray.push(buildJsonFromArray(element));
        } else {
            newArray.push(element);
        }
    }

    return newArray;
};

export const decodeDatum = (datum: string): string | Record<string, unknown> | unknown[] => {
    const decoded = cbor.decode(datum);
    if (decoded instanceof Map) {
        return buildJsonFromMap(decoded);
    } else if (Array.isArray(decoded.value)) {
        return buildJsonFromArray(decoded.value);
    }

    return decoded;
};
