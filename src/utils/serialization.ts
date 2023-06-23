import { Logger } from '@koralabs/kora-labs-common';
import { bech32 } from 'bech32';

export enum AddressType {
    Wallet = 'wallet',
    Enterprise = 'enterprise',
    Script = 'script',
    Reward = 'reward',
    Other = 'other'
}

export enum StakeAddressType {
    Script = 'f',
    Key = 'e'
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
        const addressWords = bech32.decode(address, address.length);
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

        const isTestnet = address.startsWith('addr_test');
        const prefix = isTestnet ? 'stake_test' : 'stake';

        const delegationType = `${getDelegationAddressType(parsedChar)}${isTestnet ? '0' : '1'}`;

        // stake part of the address is the last 56 bytes
        const stakeAddressDecoded = delegationType + decoded.substr(decoded.length - 56);
        const stakeAddress = bech32.encode(
            prefix,
            bech32.toWords(Uint8Array.from(Buffer.from(stakeAddressDecoded, 'hex'))),
            54 + prefix.length
        );

        return stakeAddress;
    } catch (error: any) {
        Logger.log(`Error building stake key ${error.message}`);
        return null;
    }
};
