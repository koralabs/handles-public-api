import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import { buildStakeKey, getAddressType } from './serialization';

export interface AddressDetails {
    address: string;
    type: string;
    knownOwnerName: string;
}

export const getAddressHolderDetails = async (addr: string): Promise<AddressDetails> => {
    const addressType = await getAddressType(addr);

    try {
        const stakeKey = await buildStakeKey(addr);
        const knownOwnerName = checkKnownSmartContracts(addr, stakeKey);

        return {
            address: stakeKey ?? addr,
            type: addressType,
            knownOwnerName
        };
    } catch (error: any) {
        Logger.log({
            message: `${addr} is invalid: ${JSON.stringify(error)}`,
            event: 'serialization.getAddressHolderAddress.errorSerializing',
            category: LogCategory.INFO
        });

        let knownOwnerName = checkKnownSmartContracts(addr);
        if (
            error == 'mixed-case strings not allowed' ||
            error.toString().startsWith('missing human-readable separator')
        ) {
            knownOwnerName = `contract:exchange`;
        }

        return {
            address: addr,
            type: addressType,
            knownOwnerName
        };
    }
};

export const checkKnownSmartContracts = (address: string, stake?: string | null): string => {
    switch (address) {
        case 'addr1w999n67e86jn6xal07pzxtrmqynspgx0fwmcmpua4wc6yzsxpljz3':
            return 'jpg.store';
        case 'addr1w9yr0zr530tp9yzrhly8lw5upddu0eym3yh0mjwa0qlr9pgmkzgv0':
        case 'addr1w89s3lfv7gkugker5llecq6x3k2vjvfnvp4692laeqe6w6s93vj3j':
        case 'addr1wx38kptjhuurcag7zdvh5cq98rjxt0ulf6ed7jtmz5gpkfcgjyyx3':
            return 'cnft.io';
        case 'addr1wyd3phmr5lhv3zssawqjdpnqrm5r5kgppmmf7864p3dvdrqwuutk4':
            return 'epoch.art';
        case 'addr1wxkqxmfkt6jas8mul0luqea8c5vsg8reu3ak3v9cswmm6yg2u9mrh':
            return 'freeroam.io';
        case 'addr1wxx0w0ku3jz8hz5dakg982lh22xx6q7z2z7vh0dt34uzghqrxdhqq':
            return 'Cardahub.io';
        case 'addr1wywukn5q6lxsa5uymffh2esuk8s8fel7a0tna63rdntgrysv0f3ms':
            return 'Artifct';
        case 'addr1wxz62xuzeujtuuzn2ewkrzwmm2pf79kfc84lrnjsd9ja2jscv3gy0':
            return 'Genesis House';
        case 'addr1wydpsqf5zz9ddy76d3f3jrrf6jkpyjr48nx5a706w9y68ucy4wu6s':
            return 'Yummi-Staking';
        case 'addr1wyl5fauf4m4thqze74kvxk8efcj4n7qjx005v33ympj7uwsscprfk':
            return 'Tokhun';
        case 'stake1uxqh9rn76n8nynsnyvf4ulndjv0srcc8jtvumut3989cqmgjt49h6':
            return 'jpg.store';
    }

    switch (stake) {
        case 'stake1uxqh9rn76n8nynsnyvf4ulndjv0srcc8jtvumut3989cqmgjt49h6':
            return 'jpg.store';
    }

    return '';
};
