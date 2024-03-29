import { getAddressHolderDetails } from './addresses';
import * as serialization from './serialization';

describe('addresses tests', () => {
    describe('getAddressHolderDetails', () => {
        it('should get the address holder details', async () => {
            const stakeAddress = 'stake1u8g3pqp52xuel3csupu679l4ul54uh4c2pqemefqhwdwlksjhtqld';

            const address =
                'addr1q8p0ru6eqplg6ljpm23uydwt3dy8ezzfcqs76s7w64nyxkw3zzqrg5denlr3pcre4utltelfte0ts5zpnhjjpwu6aldqgv4fdd';
            const result = await getAddressHolderDetails(address);
            expect(result).toEqual({
                address: stakeAddress,
                knownOwnerName: '',
                type: serialization.AddressType.Wallet
            });
        });

        it('should get the address holder details for jpg.store', async () => {
            const address = 'addr1w999n67e86jn6xal07pzxtrmqynspgx0fwmcmpua4wc6yzsxpljz3';
            const result = await getAddressHolderDetails(address);
            expect(result).toEqual({
                address,
                knownOwnerName: 'jpg.store',
                type: serialization.AddressType.Script
            });
        });
    });
});
