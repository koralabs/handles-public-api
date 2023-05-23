import { decodeCborToJson, encodeJsonToDatum } from './index';

describe('CBOR tests', () => {
    const plutusDataJson = {
        constructor_0: [
            {
                name: 'xar12345',
                image: 'ipfs://image_cid',
                mediaType: 'image/png',
                og: false,
                rarity: 'basic',
                length: 8,
                character_type: 'characters,numbers',
                numeric_modifier: '',
                og_number: 0,
                version: 1
            },
            1,
            {
                constructor_0: [
                    {
                        custom_image: 'ipfs://cid',
                        bg_image: 'ipfs://cid',
                        pfp_image: 'ipfs://cid',
                        settings: 'ipfs://cid',
                        socials: 'ipfs://cid',
                        vendor: 'ipfs://cid',
                        default: true,
                        holder: 'stake1...'
                    }
                ]
            }
        ]
    };

    const expectedCbor =
        'd87983aa646e616d6568786172313233343565696d61676570697066733a2f2f696d6167655f636964696d656469615479706569696d6167652f706e67626f67f466726172697479656261736963666c656e677468086e6368617261637465725f7479706572636861726163746572732c6e756d62657273706e756d657269635f6d6f64696669657260696f675f6e756d626572006776657273696f6e0101d87981a86c637573746f6d5f696d6167656a697066733a2f2f6369646862675f696d6167656a697066733a2f2f636964697066705f696d6167656a697066733a2f2f6369646873657474696e67736a697066733a2f2f63696467736f6369616c736a697066733a2f2f6369646676656e646f726a697066733a2f2f6369646764656661756c74f566686f6c646572697374616b65312e2e2e';

    const json = {
        firstKey: 'firstValue',
        secondKey: {
            firstList: ['1', '2'],
            secondList: [{ thirdKey: 'thirdValue' }, { fourthKey: 'fourthValue' }]
        }
    };

    describe('encodeJsonToDatum tests', () => {
        it('Should convert from JSON to PlutusDataCbor', async () => {
            const encoded = await encodeJsonToDatum(plutusDataJson);
            expect(encoded).toEqual(expectedCbor);
        });

        it('Should convert from JSON to TxMetadataJson', async () => {
            const encoded = await encodeJsonToDatum(json);
            expect(encoded).toEqual(
                'a26866697273744b65796a666972737456616c7565697365636f6e644b6579a26966697273744c69737482613161326a7365636f6e644c69737482a16874686972644b65796a746869726456616c7565a169666f757274684b65796b666f7572746856616c7565'
            );
        });

        it('Should encode personalization settings', async () => {
            const pzSettings = {
                constructor_0: [
                    {
                        treasury_fee: 1000000,
                        treasury_address:
                            '0x30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8',
                        pz_min_fee: 1000000,
                        pz_providers: [
                            '0x30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'
                        ],
                        valid_contracts: [
                            '0x30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'
                        ],
                        admin_creds: [
                            '0x30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'
                        ],
                        settings_address:
                            '0x30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'
                    }
                ]
            };
            const encoded = await encodeJsonToDatum(pzSettings);
            expect(encoded).toEqual(
                'd87981a76c74726561737572795f6665651a000f42407074726561737572795f61646472657373583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b86a707a5f6d696e5f6665651a000f42406c707a5f70726f76696465727381583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b86f76616c69645f636f6e74726163747381583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b86b61646d696e5f637265647381583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b87073657474696e67735f61646472657373583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'
            );
        });

        it('Should encode hex encoded values properly', async () => {
            const encoded = await encodeJsonToDatum({
                colors: ['0xffffff', '0x000000']
            });
            expect(encoded).toEqual('a166636f6c6f72738243ffffff43000000');
        });

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
                'a2581c5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6a16000581c8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eba16000'
            );
        });

        it('Should encode nested arrays and objects correctly', async () => {
            const json = [
                {
                    '5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6': {
                        '': 0
                    }
                },
                [
                    {
                        '8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eb': {
                            '': 0
                        }
                    }
                ]
            ];

            const encoded = await encodeJsonToDatum(json);
            expect(encoded).toEqual(
                '82a178383563613766346531653730386464663139353862326237653635313334373338656262613564386338303362646265353065613066336336a1600081a178383865643330633038306162613865623433316461626238303265613864646133613133316230663439633732643237363662323562316562a16000'
            );
        });

        it('Should encode really long string', async () => {
            const encoded = await encodeJsonToDatum({
                colors: '012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789'
            });
            expect(encoded).toEqual(
                'a166636f6c6f72737f7840303132333435363738393031323334353637383930313233343536373839303132333435363738393031323334353637383930313233343536373839303132337840343536373839303132333435363738393031323334353637383930313233343536373839303132333435363738393031323334353637383930313233343536377638393031323334353637383930313233343536373839ff'
            );
        });

        it('Should encode multiple constructors', async () => {
            const json = {
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
            };

            const encoded = await encodeJsonToDatum(json);
            expect(encoded).toEqual(
                'd87983a1646e616d6568786172313233343501d87a81a16c637573746f6d5f696d616765d87b81a165696d6167656a697066733a2f2f636964'
            );
        });
    });

    describe('decodeJsonDatumToJson tests', () => {
        it('Should convert from PlutusDataCbor to JSON', async () => {
            const decoded = await decodeCborToJson(expectedCbor);
            expect(decoded).toEqual({
                constructor_0: [
                    {
                        name: 'xar12345',
                        image: 'ipfs://image_cid',
                        mediaType: 'image/png',
                        og: false,
                        rarity: 'basic',
                        length: 8,
                        character_type: 'characters,numbers',
                        numeric_modifier: '',
                        og_number: 0,
                        version: 1
                    },
                    1,
                    {
                        constructor_0: [
                            {
                                custom_image: 'ipfs://cid',
                                bg_image: 'ipfs://cid',
                                pfp_image: 'ipfs://cid',
                                settings: 'ipfs://cid',
                                socials: 'ipfs://cid',
                                vendor: 'ipfs://cid',
                                default: true,
                                holder: 'stake1...'
                            }
                        ]
                    }
                ]
            });
        });

        it('Should decode cbor that is not a 12(1-4) tag', async () => {
            const cbor =
                'a2581c5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6a16000581c8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eba16000';
            const decoded = await decodeCborToJson(cbor);
            expect(decoded).toEqual({
                '0x5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6': { '': 0 },
                '0x8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eb': { '': 0 }
            });
        });

        it('Should decode cbor that is an array of objects and not a 12(1-4) tag', async () => {
            const cbor =
                '82a178383563613766346531653730386464663139353862326237653635313334373338656262613564386338303362646265353065613066336336a1600081a178383865643330633038306162613865623433316461626238303265613864646133613133316230663439633732643237363662323562316562a16000';
            const decoded = await decodeCborToJson(cbor);
            expect(decoded).toEqual([
                {
                    '5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6': {
                        '': 0
                    }
                },
                [
                    {
                        '8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eb': {
                            '': 0
                        }
                    }
                ]
            ]);
        });

        it('Should decode pz settings', async () => {
            const cbor =
                'd87981a76c74726561737572795f6665651a000f42407074726561737572795f61646472657373583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b86a707a5f6d696e5f6665651a000f42406c707a5f70726f76696465727381583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b86f76616c69645f636f6e74726163747381583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b86b61646d696e5f637265647381583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b87073657474696e67735f61646472657373583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8';
            const decoded = await decodeCborToJson(cbor);
            expect(decoded).toEqual({
                constructor_0: [
                    {
                        admin_creds: [
                            '0x30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'
                        ],
                        pz_min_fee: 1000000,
                        pz_providers: [
                            '0x30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'
                        ],
                        settings_address:
                            '0x30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8',
                        treasury_address:
                            '0x30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8',
                        treasury_fee: 1000000,
                        valid_contracts: [
                            '0x30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'
                        ]
                    }
                ]
            });
        });

        it('Should decode hex properly', async () => {
            const cbor =
                'd87983aa446e616d655f4e24746573742d68652d3030303134ff45696d6167655f5838697066733a2f2f7a623272686875426946656a564a53545876613741644137464b5a6336424c52397a515048753146396a69635541346f33ff496d65646961547970655f4a696d6167652f6a706567ff426f6700496f675f6e756d62657200467261726974795f456261736963ff466c656e6774680d4a636861726163746572735f576c6574746572732c6e756d626572732c7370656369616cff516e756d657269635f6d6f646966696572735fff4776657273696f6e0101a84e7374616e646172645f696d6167655f5838697066733a2f2f7a623272686875426946656a564a53545876613741644137464b5a6336424c52397a515048753146396a69635541346f33ff46706f7274616c5fff4864657369676e65725fff47736f6369616c735fff4676656e646f725fff4764656661756c7400536c6173745f7570646174655f616464726573735f583900f749548d2cd66bb9adc5c508de3c9ff938d19f59e93aa623eb356c022b61a21becbc6b3199bab4f0f5eaabafcc50eb87ecf5cc843465d625ff4c76616c6964617465645f62795f581c4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e1ff';
            const decoded = await decodeCborToJson(cbor);
            expect(decoded).toEqual({ colors: ['0xffffff', '0x000000'] });
        });

        it('Should decode nested constructors', async () => {
            const cbor =
                'd87983a1646e616d6568786172313233343501d87a81a16c637573746f6d5f696d616765d87b81a165696d6167656a697066733a2f2f636964';
            const decoded = await decodeCborToJson(cbor);
            expect(decoded).toEqual({
                constructor_0: [
                    { name: 'xar12345' },
                    1,
                    { constructor_1: [{ custom_image: { constructor_2: [{ image: 'ipfs://cid' }] } }] }
                ]
            });
        });
    });
});
