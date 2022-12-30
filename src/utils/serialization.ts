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
