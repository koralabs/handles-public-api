import { buildStakeKey, getAddressType } from './serialization';

describe('Serialization Test', () => {
    describe('getHolderAddressFromAddress', () => {
        it.skip('should convert an address to a stake key', async () => {
            const address = 'addr1vx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzers66hrl8';
            //'addr1w999n67e86jn6xal07pzxtrmqynspgx0fwmcmpua4wc6yzsxpljz3'
            // 'addr1q8p0ru6eqplg6ljpm23uydwt3dy8ezzfcqs76s7w64nyxkw3zzqrg5denlr3pcre4utltelfte0ts5zpnhjjpwu6aldqgv4fdd';
            const stakeKey = await buildStakeKey(address);
            expect(stakeKey).toEqual(null); // 'stake1u8g3pqp52xuel3csupu679l4ul54uh4c2pqemefqhwdwlksjhtqld'
        });
    });

    describe('getAddressType', () => {
        it.skip('should get the correct address type for enterprise', async () => {
            const number = await getAddressType('addr1vx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzers66hrl8');
            expect(number).toEqual(6);
        });
    });
});
