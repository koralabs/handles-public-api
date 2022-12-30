import { AddressType, getAddressHolderDetails, inspect } from './addresses';
import * as serialization from './serialization';

jest.mock('./serialization');

describe('addresses tests', () => {
    describe('inspect', () => {
        it('should inspect an address', async () => {
            const address =
                'DdzFFzCqrht4GSeFm69wTpZpJZjX6qedAEm9HCKCXAfCwpMP69HCn1xDZzoxx1Xmvxo3gaHqRzDiYd2WzSbZ1M5R6yTK6s1wk9VkN1o7';
            const result = await inspect(address);
            expect(result).toEqual({
                address_root: 'bb2a408e26a10fde5d49d97c9ffb5c5af2cdf47e8ec2e76286b72958',
                address_style: 'Byron',
                address_type: 8,
                derivation_path: '581c341540aaf534d92d6fb4f3422b22273c6d41a36b5b4743019a5a834a',
                network_tag: null,
                stake_reference: 'none'
            });
        });
    });

    describe('getAddressHolderDetails', () => {
        it('should get the address holder details', async () => {
            const stakeAddress = 'stake1u8';
            jest.spyOn(serialization, 'buildStakeKey').mockResolvedValue(stakeAddress);

            const address =
                'addr1q8p0ru6eqplg6ljpm23uydwt3dy8ezzfcqs76s7w64nyxkw3zzqrg5denlr3pcre4utltelfte0ts5zpnhjjpwu6aldqgv4fdd';
            const result = await getAddressHolderDetails(address);
            expect(result).toEqual({
                address: stakeAddress,
                knownOwnerName: '',
                type: AddressType.Script
            });
        });

        it('should get the address holder details for jpg.store', async () => {
            jest.spyOn(serialization, 'buildStakeKey').mockResolvedValue(null);

            const address = 'addr1w999n67e86jn6xal07pzxtrmqynspgx0fwmcmpua4wc6yzsxpljz3';
            const result = await getAddressHolderDetails(address);
            expect(result).toEqual({
                address,
                knownOwnerName: 'jpg.store',
                type: AddressType.Other
            });
        });
    });
});
