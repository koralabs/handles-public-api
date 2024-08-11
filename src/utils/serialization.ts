import { decodeCborToJson, IS_PRODUCTION, Logger } from '@koralabs/kora-labs-common';
import { bech32 } from 'bech32';
import bs58 from 'bs58';

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
        const stakeAddressDecoded = delegationType + decoded.slice(decoded.length - 56);
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

export const getPaymentKeyHash = async (address: string): Promise<string | null> => {
    try {
        const decoded = decodeAddress(address);
        if (!decoded) {
            try {
                // Try Byron addresses
                const jsonAddress = await decodeCborToJson({cborString: Buffer.from(bs58.decode(address)).toString('hex')});
                const innerAddress = await decodeCborToJson({cborString: (jsonAddress[0].value as Buffer).toString('hex')});
                return (innerAddress[0] as Buffer).toString('hex').slice(2);
            }
            catch {
                return null;
            }
        }
        else {
            //console.log(decoded)
            return decoded.slice(2, 58);
        }

    } catch (error: any) {
        Logger.log(`Error getting payment key ${error.message}`);
        return null;
    }
};

export const bech32FromHex = (hex: string, isTestnet = !IS_PRODUCTION, type: 'addr' | 'stake' | 'pool' | 'drep' = 'addr'): string => {
    const prefix = isTestnet ? `${type}_test` : type;
    const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
    const words = bech32.toWords(bytes);
    return bech32.encode(prefix, words, bytes.length * 2 + prefix.length);
};
