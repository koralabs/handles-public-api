//import lib from '@emurgo/cardano-serialization-lib-nodejs';
import { LogCategory, Logger } from '@koralabs/logger';
import { NODE_ENV } from '../config';

let cardanoWasm: any = null;

export const loadCardanoWasm = async () => {
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
            return checkKnownSmartContracts(addr, stake);
        }
        return checkKnownSmartContracts(addr, null);
    } catch (error: any) {
        Logger.log({
            message: `${addr} is invalid: ${JSON.stringify(error)}`,
            event: 'serialization.getAddressStakeKey.errorSerializing',
            category: LogCategory.INFO
        });
        if (error == "mixed-case strings not allowed" || error.toString().startsWith('missing human-readable separator')) {
            return "contract:exchange";
        }
    }
    return null;
};

const checkKnownSmartContracts = (address: string, stake: string | null): string | null => {
    switch (address){
        case 'addr1w999n67e86jn6xal07pzxtrmqynspgx0fwmcmpua4wc6yzsxpljz3':
            return 'contract:jpg.store';
        case 'addr1w9yr0zr530tp9yzrhly8lw5upddu0eym3yh0mjwa0qlr9pgmkzgv0':
        case 'addr1w89s3lfv7gkugker5llecq6x3k2vjvfnvp4692laeqe6w6s93vj3j':
        case 'addr1wx38kptjhuurcag7zdvh5cq98rjxt0ulf6ed7jtmz5gpkfcgjyyx3':
            return 'contract:cnft.io';
        case 'addr1wyd3phmr5lhv3zssawqjdpnqrm5r5kgppmmf7864p3dvdrqwuutk4':
            return 'contract:epoch.art';
        case 'addr1wxkqxmfkt6jas8mul0luqea8c5vsg8reu3ak3v9cswmm6yg2u9mrh':
            return 'contract:freeroam.io';
        case 'addr1wxx0w0ku3jz8hz5dakg982lh22xx6q7z2z7vh0dt34uzghqrxdhqq':
            return 'contract:Cardahub.io';
        case 'addr1wywukn5q6lxsa5uymffh2esuk8s8fel7a0tna63rdntgrysv0f3ms':
            return 'contract:Artifct';
        case 'addr1wxz62xuzeujtuuzn2ewkrzwmm2pf79kfc84lrnjsd9ja2jscv3gy0':
            return 'contract:Genesis House';
        case 'addr1wydpsqf5zz9ddy76d3f3jrrf6jkpyjr48nx5a706w9y68ucy4wu6s':
            return 'contract:Yummi-Staking';
        case 'addr1wyl5fauf4m4thqze74kvxk8efcj4n7qjx005v33ympj7uwsscprfk':
            return 'contract:Tokhun';
    }
    switch (stake){
        case 'stake1uxqh9rn76n8nynsnyvf4ulndjv0srcc8jtvumut3989cqmgjt49h6':
            return 'contract:jpg.store';
    }
    return stake?.startsWith('stake') ? stake : null;
}
