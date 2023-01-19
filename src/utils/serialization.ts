// import lib from '@emurgo/cardano-serialization-lib-nodejs';
import { NODE_ENV } from '../config';

let cardanoWasm: any = null;

// Need to dynamically load cardano-serialization-lib-nodejs because tests will fail
export const loadCardanoWasm = async () => {
    if (cardanoWasm || NODE_ENV === 'test') {
        return cardanoWasm;
    }

    cardanoWasm = await import('@emurgo/cardano-serialization-lib-nodejs');
    return cardanoWasm;
};

export enum AddressType {
    Wallet = 'stake',
    Enterprise = 'enterprise',
    Script = 'script',
    Other = 'other'
}

const switchAddressType = (addressType: number): AddressType => {
    // https://cips.cardano.org/cips/cip19/#shelleyaddresses
    if (addressType >= 8) {
        return AddressType.Other;
    } else if (addressType === 6) {
        return AddressType.Enterprise;
    } else if (addressType % 2 === 0) {
        return AddressType.Wallet;
    } else {
        return AddressType.Script;
    }
};

export const getAddressType = async (address: string): Promise<AddressType> => {
    const lib = await loadCardanoWasm();
    if (lib) {
        try {
            const hashedAddress = lib.Address.from_bech32(address);
            const firstByte = byteString(hashedAddress.to_bytes()[0]);
            const header = firstByte.slice(0, 4);
            return switchAddressType(parseInt(header, 2));
        } catch (error) {}
    }
    return AddressType.Other;
};

export const buildStakeKey = async (address: string): Promise<string | null> => {
    const lib = await loadCardanoWasm();
    if (lib) {
        const hashedAddress = lib.Address.from_bech32(address);
        const base = lib.BaseAddress.from_address(hashedAddress);
        if (base) {
            const stakeAddress = lib.RewardAddress.new(hashedAddress.network_id(), base.stake_cred())
                .to_address()
                .to_bech32();
            return stakeAddress;
        }
    }

    return null;
};

function byteString(n: any) {
    if (n < 0 || n > 255 || n % 1 !== 0) {
        throw new Error(n + ' does not fit in a byte');
    }
    return ('000000000' + n.toString(2)).substr(-8);
}
