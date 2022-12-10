//import lib from '@emurgo/cardano-serialization-lib-nodejs';
import { LogCategory, Logger } from '@koralabs/logger';
import { NODE_ENV } from '../config';

let cardanoWasm: any = null;

const loadCardanoWasm = async () => {
    if (cardanoWasm || NODE_ENV === 'test') {
        return cardanoWasm;
    }

    cardanoWasm = await import('@emurgo/cardano-serialization-lib-nodejs');
    return cardanoWasm;
};

export const getAddressStakeKey = async (addr: string): Promise<string | null> => {
    const lib = await loadCardanoWasm();
    if (!lib) {
        Logger.log({
            message: 'Unable to load CardanoWasm',
            event: 'serialization.getAddressStakeKey.noCardanoWasm',
            category: LogCategory.ERROR
        });
        return null;
    }
    try {
        const address = lib.Address.from_bech32(addr);
        const base = lib.BaseAddress.from_address(address);
        if (base) {
            const stake = lib.RewardAddress.new(address.network_id(), base.stake_cred()).to_address().to_bech32();
            return stake;
        }

        Logger.log(`Unable to get BaseAddress from ${addr}`);
    } catch (error: any) {
        Logger.log({
            message: `Error getting BaseAddress ${addr} with message: ${error.message}`,
            event: 'serialization.getAddressStakeKey.errorSerializing',
            category: LogCategory.ERROR
        });
    }

    return null;
};
