import * as lib from '@emurgo/cardano-serialization-lib-nodejs';
import { Logger } from './logger';

export const getAddressStakeKey = (addr: string): string | null => {
    const address = lib.Address.from_bech32(addr);
    const base = lib.BaseAddress.from_address(address);
    if (base) {
        const stake = lib.RewardAddress.new(address.network_id(), base.stake_cred()).to_address().to_bech32();
        return stake;
    }

    Logger.log(`Unable to get BaseAddress from ${addr}`);
    return null;
};
