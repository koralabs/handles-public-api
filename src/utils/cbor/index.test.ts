import { decodeCborToJson, encodeJsonToDatum } from './index';
import { handleDatumSchema } from './schema/handleData';
import { designerSchema } from './schema/designer';
import { IPersonalizationDesigner } from '@koralabs/handles-public-api-interfaces';
import { portalSchema } from './schema/portal';

describe('CBOR tests', () => {
    describe('Encode/decode Handle JSON and PlutusDataCbor', () => {
        const plutusDataJson = {
            constructor_0: [
                {
                    name: 'xar12345',
                    image: 'ipfs://image_cid',
                    mediaType: 'image/jpeg',
                    og: true,
                    og_number: 0,
                    rarity: 'basic',
                    length: 8,
                    characters: 'characters,numbers',
                    numeric_modifiers: '',
                    version: 1
                },
                1,
                {
                    standard_image: 'ipfs://cid',
                    bg_image: 'ipfs://cid',
                    pfp_image: 'ipfs://cid',
                    pfp_asset: '0x4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e1',
                    bg_asset: '0x4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e1',
                    portal: 'ipfs://cid',
                    designer: 'ipfs://cid',
                    socials: 'ipfs://cid',
                    vendor: 'ipfs://cid',
                    default: false,
                    last_update_address:
                        '0x00f749548d2cd66bb9adc5c508de3c9ff938d19f59e93aa623eb356c022b61a21becbc6b3199bab4f0f5eaabafcc50eb87ecf5cc843465d625',
                    validated_by: '0x4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e1',
                    trial: true
                }
            ]
        };

        const expectedCbor =
            'd8799faa446e616d6548786172313233343545696d61676550697066733a2f2f696d6167655f636964496d65646961547970654a696d6167652f6a706567426f6701496f675f6e756d6265720046726172697479456261736963466c656e677468084a6368617261637465727352636861726163746572732c6e756d62657273516e756d657269635f6d6f64696669657273404776657273696f6e0101ad4e7374616e646172645f696d6167654a697066733a2f2f6369644862675f696d6167654a697066733a2f2f636964497066705f696d6167654a697066733a2f2f636964497066705f6173736574581c4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e14862675f6173736574581c4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e146706f7274616c4a697066733a2f2f6369644864657369676e65724a697066733a2f2f63696447736f6369616c734a697066733a2f2f6369644676656e646f724a697066733a2f2f6369644764656661756c7400536c6173745f7570646174655f61646472657373583900f749548d2cd66bb9adc5c508de3c9ff938d19f59e93aa623eb356c022b61a21becbc6b3199bab4f0f5eaabafcc50eb87ecf5cc843465d6254c76616c6964617465645f6279581c4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e145747269616c01ff';

        it('Should convert from JSON to PlutusDataCbor', async () => {
            const encoded = await encodeJsonToDatum(plutusDataJson);
            expect(encoded).toEqual(expectedCbor);
        });

        it('Should convert from PlutusDataCbor to JSON', async () => {
            const decoded = await decodeCborToJson(expectedCbor, handleDatumSchema);
            expect(decoded).toEqual({
                constructor_0: [
                    {
                        characters: 'characters,numbers',
                        image: 'ipfs://image_cid',
                        length: 8,
                        mediaType: 'image/jpeg',
                        name: 'xar12345',
                        numeric_modifiers: '',
                        og: true,
                        og_number: 0,
                        rarity: 'basic',
                        version: 1
                    },
                    1,
                    {
                        bg_asset: '0x4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e1',
                        bg_image: 'ipfs://cid',
                        default: false,
                        designer: 'ipfs://cid',
                        last_update_address:
                            '0x00f749548d2cd66bb9adc5c508de3c9ff938d19f59e93aa623eb356c022b61a21becbc6b3199bab4f0f5eaabafcc50eb87ecf5cc843465d625',
                        pfp_asset: '0x4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e1',
                        pfp_image: 'ipfs://cid',
                        portal: 'ipfs://cid',
                        socials: 'ipfs://cid',
                        standard_image: 'ipfs://cid',
                        trial: true,
                        validated_by: '0x4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e1',
                        vendor: 'ipfs://cid'
                    }
                ]
            });
        });
    });

    describe('Encode/decode designer datum', () => {
        const getJson = (): IPersonalizationDesigner => ({
            font_shadow_color: '0x000000',
            bg_color: '0x0a1fd3',
            bg_border_color: '0x0a1fd3',
            qr_link: 'https://handle.me/burrito',
            socials: [{ display: 'taco', url: 'https://handle.me/taco' }],
            pfp_border_color: '0x0a1fd3',
            qr_inner_eye: 'rounded,#0a1fd3',
            qr_outer_eye: 'square,#0a1fd3',
            qr_dot: 'dot,#0a1fd3',
            qr_bg_color: '0x22d1af',
            pfp_zoom: 20,
            pfp_offset: [124, 58],
            font: 'Family Name,https://fonts.com/super_cool_font.woff',
            font_color: '0x0a1fd3',
            font_shadow_size: [12, 12, 8],
            text_ribbon_colors: ['0x0a1fd3', '0x22d1af', '0x31bc23'],
            text_ribbon_gradient: 'linear-45'
        });

        const cbor =
            'b151666f6e745f736861646f775f636f6c6f72430000004862675f636f6c6f72430a1fd34f62675f626f726465725f636f6c6f72430a1fd34771725f6c696e6b581968747470733a2f2f68616e646c652e6d652f6275727269746f47736f6369616c739fa247646973706c6179447461636f4375726c5668747470733a2f2f68616e646c652e6d652f7461636fff507066705f626f726465725f636f6c6f72430a1fd34c71725f696e6e65725f6579654f726f756e6465642c233061316664334c71725f6f757465725f6579654e7371756172652c233061316664334671725f646f744b646f742c233061316664334b71725f62675f636f6c6f724322d1af487066705f7a6f6f6d144a7066705f6f66667365749f187c183aff44666f6e74583246616d696c79204e616d652c68747470733a2f2f666f6e74732e636f6d2f73757065725f636f6f6c5f666f6e742e776f66664a666f6e745f636f6c6f72430a1fd350666f6e745f736861646f775f73697a659f0c0c08ff52746578745f726962626f6e5f636f6c6f72739f430a1fd34322d1af4331bc23ff54746578745f726962626f6e5f6772616469656e74496c696e6561722d3435';
        it('Should convert designer datum to cbor', async () => {
            const encoded = await encodeJsonToDatum(getJson());
            expect(encoded).toEqual(cbor);
        });

        it('Should convert cbor to designer datum', async () => {
            const decoded = await decodeCborToJson(cbor, designerSchema);
            expect(decoded).toEqual(getJson());
        });
    });

    describe('Encode/decode portal datum', () => {
        const getJson = () => ({
            type: 'redirect',
            domain: 'https://handle.me',
            default: true
        });

        const cbor =
            'a3447479706548726564697265637446646f6d61696e5168747470733a2f2f68616e646c652e6d654764656661756c7401';

        it('Should convert portal datum to cbor', async () => {
            const encoded = await encodeJsonToDatum(getJson());
            expect(encoded).toEqual(cbor);
        });

        it('Should convert cbor to portal datum', async () => {
            const decoded = await decodeCborToJson(cbor, portalSchema);
            expect(decoded).toEqual(getJson());
        });
    });

    describe('Encode/decode Standard JSON and PlutusDataCbor', () => {
        const json = {
            firstKey: 'string',
            secondKey: {
                firstList: [1, 3],
                '0x222222': [{ thirdKey: '222222' }, { fourthKey: '0x333333' }, { fifthKey: 0 }]
            }
        };

        const cbor =
            'a24866697273744b657946737472696e67497365636f6e644b6579a24966697273744c6973749f0103ff432222229fa14874686972644b657946323232323232a149666f757274684b657943333333a14866696674684b657900ff';

        it('Should convert from JSON to TxMetadataJson', async () => {
            const encoded = await encodeJsonToDatum(json);
            expect(encoded).toEqual(cbor);
        });

        it('Should decode from TxMetadataJson to JSON', async () => {
            const schema = {
                firstKey: 'string',
                secondKey: {
                    firstList: {
                        '[0]': 'bool'
                    },
                    '<hexstring>': {
                        '[0]': {
                            thirdKey: 'string'
                        },
                        '[2]': {
                            fifthKey: 'number'
                        }
                    }
                }
            };

            const expectedJson = {
                firstKey: 'string',
                secondKey: {
                    firstList: [true, 3],
                    '0x222222': [{ thirdKey: '222222' }, { fourthKey: '0x333333' }, { fifthKey: 0 }]
                }
            };

            const decoded = await decodeCborToJson(cbor, schema);
            expect(decoded).toEqual(expectedJson);
        });
    });

    describe('Encode/decode personalization settings', () => {
        const pzSettings = [
            1500000,
            '0x300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8',
            3500000,
            ['0x300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'],
            ['0x3ac54dace81eb69b2c974a1db2b89f2529fbf4da97c482decb32b6a5'],
            ['0x151a82d0669a20bd77de1296eee5ef1259ce98ecd81bd7121825f9eb'],
            '0x300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'
        ];

        const pzCbor =
            '9f1a0016e360581c300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b81a003567e09f581c300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8ff9f581c3ac54dace81eb69b2c974a1db2b89f2529fbf4da97c482decb32b6a5ff9f581c151a82d0669a20bd77de1296eee5ef1259ce98ecd81bd7121825f9ebff581c300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8ff';

        it('Should encode personalization settings', async () => {
            const encoded = await encodeJsonToDatum(pzSettings);
            expect(encoded).toEqual(pzCbor);
        });

        it('Should decode personalization settings', async () => {
            const decoded = await decodeCborToJson(pzCbor);
            expect(decoded).toEqual([
                1500000,
                '0x300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8',
                3500000,
                ['0x300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'],
                ['0x3ac54dace81eb69b2c974a1db2b89f2529fbf4da97c482decb32b6a5'],
                ['0x151a82d0669a20bd77de1296eee5ef1259ce98ecd81bd7121825f9eb'],
                '0x300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'
            ]);
        });
    });

    describe('Encode/decode hex colors', () => {
        it('Should encode hex encoded values properly', async () => {
            const encoded = await encodeJsonToDatum({
                colors: ['0xffffff', '0x000000']
            });
            expect(encoded).toEqual('a146636f6c6f72739f43ffffff43000000ff');
        });

        it('Should decode hex properly', async () => {
            const cbor = 'a166636f6c6f72738243ffffff43000000';
            const decoded = await decodeCborToJson(cbor);
            expect(decoded).toEqual({ colors: ['0xffffff', '0x000000'] });
        });
    });

    describe('Encode/decode nested constructors', () => {
        it('Should encode multiple constructors', async () => {
            const json = [
                {
                    constructor_0: [
                        {
                            name: 'xar12345'
                        },
                        1,
                        {
                            constructor_1: [
                                {
                                    custom_image: {
                                        constructor_2: [{ image: 'ipfs://cid' }]
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    constructor_0: [
                        {
                            name: 'xar12345'
                        },
                        1,
                        {
                            constructor_1: [
                                {
                                    custom_image: {
                                        constructor_2: [{ image: 'ipfs://cid' }]
                                    }
                                }
                            ]
                        }
                    ]
                }
            ];

            const encoded = await encodeJsonToDatum(json);
            expect(encoded).toEqual(
                '9fd8799fa1446e616d6548786172313233343501d87a9fa14c637573746f6d5f696d616765d87b9fa145696d6167654a697066733a2f2f636964ffffffd8799fa1446e616d6548786172313233343501d87a9fa14c637573746f6d5f696d616765d87b9fa145696d6167654a697066733a2f2f636964ffffffff'
            );
        });

        it('Should decode nested constructors', async () => {
            const cbor =
                '82d87983a1446e616d6548786172313233343501d87a81a14c637573746f6d5f696d616765d87b81a145696d6167654a697066733a2f2f636964d87983a1446e616d6548786172313233343501d87a81a14c637573746f6d5f696d616765d87b81a145696d6167654a697066733a2f2f636964';
            const decoded = await decodeCborToJson(cbor);
            expect(decoded).toEqual([
                {
                    constructor_0: [
                        { name: '0x7861723132333435' },
                        1,
                        { constructor_1: [{ custom_image: { constructor_2: [{ image: '0x697066733a2f2f636964' }] } }] }
                    ]
                },
                {
                    constructor_0: [
                        { name: '0x7861723132333435' },
                        1,
                        { constructor_1: [{ custom_image: { constructor_2: [{ image: '0x697066733a2f2f636964' }] } }] }
                    ]
                }
            ]);
        });
    });

    describe('encodeJsonToDatum tests', () => {
        it('Should encode policyIds correctly', async () => {
            const json = {
                '0x5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6': {
                    '': 0
                },
                '0x8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eb': {
                    '': 0
                }
            };

            const encoded = await encodeJsonToDatum(json);
            expect(encoded).toEqual(
                'a2581c5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6a14000581c8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eba14000'
            );
        });

        it('Should encode nested arrays and objects correctly', async () => {
            const json = [
                {
                    '0x5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6': {
                        '': 0
                    }
                },
                [
                    {
                        '0x8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eb': {
                            '': 0
                        }
                    },
                    {
                        '0x444444': {
                            '': 0
                        }
                    }
                ]
            ];

            const encoded = await encodeJsonToDatum(json);
            expect(encoded).toEqual(
                '9fa1581c5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6a140009fa1581c8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eba14000a143444444a14000ffff'
            );
        });

        it('Should encode really long string', async () => {
            const encoded = await encodeJsonToDatum({
                colors: '012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789'
            });
            expect(encoded).toEqual(
                'a146636f6c6f72735f5840303132333435363738393031323334353637383930313233343536373839303132333435363738393031323334353637383930313233343536373839303132335840343536373839303132333435363738393031323334353637383930313233343536373839303132333435363738393031323334353637383930313233343536375638393031323334353637383930313233343536373839ff'
            );
        });
    });

    describe('decodeJsonDatumToJson tests', () => {
        it('Should decode cbor that is not a 12(1-4) tag', async () => {
            const cbor =
                'a2581c5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6a14000581c8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eba14000';

            const schema = {
                '<hexstring>': {
                    '<hexstring>': 'number'
                }
            };
            const decoded = await decodeCborToJson(cbor, schema);
            expect(decoded).toEqual({
                '0x5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6': { '0x': 0 },
                '0x8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eb': { '0x': 0 }
            });
        });

        it('Should decode cbor that is an array of objects and not a 12(1-4) tag', async () => {
            const cbor =
                '82a1581c5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6a1400082a1581c8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eba14000a143444444a14000';

            const schema = {
                '[0]': {
                    '<hexstring>': {
                        '<hexstring>': 'number'
                    }
                },
                '[1]': {
                    '[all]': {
                        '<hexstring>': {
                            '<hexstring>': 'number'
                        }
                    }
                }
            };

            const decoded = await decodeCborToJson(cbor, schema);
            expect(decoded).toEqual([
                { '0x5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6': { '0x': 0 } },
                [
                    { '0x8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eb': { '0x': 0 } },
                    { '0x444444': { '0x': 0 } }
                ]
            ]);
        });
    });
});
