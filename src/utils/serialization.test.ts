import { AddressType, buildStakeKey, buildPaymentAddressType, bech32FromHex } from './serialization';

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

        it('should build a proper stake key for testnet', () => {
            const stakeKey = buildStakeKey(
                'addr_test1qpc34q6xuwjqn4l0f283xgct0e6z2x4l4sxufpmap2an9eptvx3phm9udvcenw457r6742a0e3gwhplv7hxggdr96cjstkwxff'
            );
            expect(stakeKey).toEqual('stake_test1uq4krgsmaj7xkvveh260pa024whuc58tslk0tnyyx3javfg36sly7');
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

    describe('bech32FromHex', () => {
        it('should convert hex to bech32 address and stake key', async () => {
            const hex =
                '007ad324c4fb08709dd997f6b2ba7980d5007103a2aa3f7a7eb8b44bc6f1a8e379127b811583070faf74db00d880d45027fe6171b1b69bd9ca';
            const result = bech32FromHex(hex, true);
            expect(result).toEqual(
                'addr_test1qpadxfxylvy8p8wejlmt9wnesr2squgr524r77n7hz6yh3h34r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qqh563f'
            );
        });

        it('should convert hex to bech32', async () => {
            const hex =
                '007ad324c4fb08709dd997f6b2ba7980d5007103a2aa3f7a7eb8b44bc6f1a8e379127b811583070faf74db00d880d45027fe6171b1b69bd9ca';
            const result = bech32FromHex(hex, true);
            expect(result).toEqual(
                'addr_test1qpadxfxylvy8p8wejlmt9wnesr2squgr524r77n7hz6yh3h34r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qqh563f'
            );
        });
    });
});
