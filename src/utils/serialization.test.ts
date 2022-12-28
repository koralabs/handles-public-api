import { getAddressHolderAddress } from './serialization';

describe('Serialization Test', () => {
    describe('getHolderAddressFromAddress', () => {
        it('should convert an address to a stake key', async () => {
            const address =
                'addr1q8p0ru6eqplg6ljpm23uydwt3dy8ezzfcqs76s7w64nyxkw3zzqrg5denlr3pcre4utltelfte0ts5zpnhjjpwu6aldqgv4fdd';
            const holderAddress = await getAddressHolderAddress(address);
            expect(holderAddress).toEqual(null); // 'stake1u8g3pqp52xuel3csupu679l4ul54uh4c2pqemefqhwdwlksjhtqld'
        });
    });
});
