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
                'd8799fbf446e616d654a24742d646174756d2d3145696d6167655835697066733a2f2f516d62514561755a5243503233765369487058314d33636a6d694134715075437068594663763436617a4c4b6d41496d656469615479706549696d6167652f706e67426f674566616c736546726172697479456261736963466c656e67746841394e6368617261637465725f74797065576c6574746572732c6e756d626572732c7370656369616c506e756d657269635f6d6f646966696572404776657273696f6e4131ff01bf4c637573746f6d5f696d616765404862675f696d61676540497066705f696d616765404873657474696e67735835697066733a2f2f516d6646784a63647a746e71644d6b4a325874676f78326648667170646a784c464332773373366d4437744c483347736f6369616c735835697066733a2f2f516d524a444a4134663846646d6b635772413552594348726d3736714c7a6a6271377239726d384777364c7662724676656e646f72404764656661756c744566616c736546686f6c64657240ffff'
            );

            expect(decoded).toEqual([
                {
                    character_type: 'letters,numbers,special',
                    image: 'ipfs://QmbQEauZRCP23vSiHpX1M3cjmiA4qPuCphYFcv46azLKmA',
                    length: '9',
                    mediaType: 'image/png',
                    name: '$t-datum-1',
                    numeric_modifier: '',
                    og: 'false',
                    rarity: 'basic',
                    version: '1'
                },
                1,
                {
                    bg_image: '',
                    custom_image: '',
                    default: 'false',
                    holder: '',
                    pfp_image: '',
                    settings: 'ipfs://QmfFxJcdztnqdMkJ2Xtgox2fHfqpdjxLFC2w3s6mD7tLH3',
                    socials: 'ipfs://QmRJDJA4f8FdmkcWrA5RYCHrm76qLzjbq7r9rm8Gw6Lvbr',
                    vendor: ''
                }
            ]);
        });

        it('should convert other datum style', () => {
            const decoded = decodeDatum('d8799f182aff');
            expect(decoded).toEqual([42]);
        });

        it.skip('should go the other way', () => {
            // TODO: implement this
        });
    });
});
