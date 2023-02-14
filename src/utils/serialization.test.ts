import { AddressType, buildStakeKey, buildPaymentAddressType, decodeDatum } from './serialization';

const addresses = [
    'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x',
    'addr1z8phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gten0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs9yc0hh',
    'addr1yx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzerkr0vd4msrxnuwnccdxlhdjar77j6lg0wypcc9uar5d2shs2z78ve',
    'addr1x8phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gt7r0vd4msrxnuwnccdxlhdjar77j6lg0wypcc9uar5d2shskhj42g',
    'addr1gx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer5pnz75xxcrzqf96k',
    'addr128phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gtupnz75xxcrtw79hu',
    'addr1vx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzers66hrl8',
    'addr1w8phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gtcyjy7wx',
    'stake1uyehkck0lajq8gr28t9uxnuvgcqrc6070x3k9r8048z8y5gh6ffgw',
    'stake178phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gtcccycj5'
];

describe('Serialization Test', () => {
    describe('getHolderAddressFromAddress', () => {
        it('should build stake keys', async () => {
            const array = addresses.map((addr) => buildStakeKey(addr));
            expect(array).toEqual([
                'stake1uyehkck0lajq8gr28t9uxnuvgcqrc6070x3k9r8048z8y5gh6ffgw',
                'stake1uyehkck0lajq8gr28t9uxnuvgcqrc6070x3k9r8048z8y5gh6ffgw',
                'stake178phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gtcccycj5',
                'stake178phkx6acpnf78fuvxn0mkew3l0fd058hzquvz7w36x4gtcccycj5',
                null,
                null,
                null,
                null,
                null,
                null
            ]);
        });
    });

    describe('getAddressType', () => {
        it('should get the correct address types for addresses', async () => {
            const array = addresses.map((addr) => buildPaymentAddressType(addr));
            expect(array).toEqual([
                'wallet',
                'script',
                'wallet',
                'script',
                'wallet',
                'script',
                'enterprise',
                'script',
                'reward',
                'reward'
            ]);
        });

        it('should return other for Byron era address', async () => {
            const type = buildPaymentAddressType(
                '37btjrVyb4KDXBNC4haBVPCrro8AQPHwvCMp3RFhhSVWwfFmZ6wwzSK6JK1hY6wHNmtrpTf1kdbva8TCneM2YsiXT7mrzT21EacHnPpz5YyUdj64na'
            );
            expect(type).toEqual(AddressType.Other);
        });
    });

    describe('decodeDatum', () => {
        it('should debug JSON datum', () => {
            const decoded = decodeDatum(
                'a21904d2a1517e62672d7061747465726e2d6d61746368a3412d05487e7061747465726e14497e7061747465726e320a58386562363664323135396435316365633762643436396330646165663861393365306432303636663535643363316139636635626330333933a1412da1412d00'
            );

            expect(decoded).toEqual({
                '1234': { '~bg-pattern-match': { '-': 5, '~pattern': 20, '~pattern2': 10 } },
                eb66d2159d51cec7bd469c0daef8a93e0d2066f55d3c1a9cf5bc0393: { '-': { '-': 0 } }
            });
        });

        it('should convert other datum style', () => {
            const decoded = decodeDatum('d8799f182aff');
            expect(decoded).toEqual({ err: undefined, tag: 121, value: [42] });
        });

        it.skip('should go the other way', () => {
            // TODO: implement this
        });
    });
});
