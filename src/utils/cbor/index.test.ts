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
        'd87983aa446e616d655f487861723132333435ff45696d6167655f50697066733a2f2f696d6167655f636964ff496d65646961547970655f49696d6167652f706e67ff426f67f4467261726974795f456261736963ff466c656e677468084e6368617261637465725f747970655f52636861726163746572732c6e756d62657273ff506e756d657269635f6d6f6469666965725fff496f675f6e756d626572004776657273696f6e0101d87981a84c637573746f6d5f696d6167655f4a697066733a2f2f636964ff4862675f696d6167655f4a697066733a2f2f636964ff497066705f696d6167655f4a697066733a2f2f636964ff4873657474696e67735f4a697066733a2f2f636964ff47736f6369616c735f4a697066733a2f2f636964ff4676656e646f725f4a697066733a2f2f636964ff4764656661756c74f546686f6c6465725f497374616b65312e2e2eff';

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
                'a24866697273744b65795f4a666972737456616c7565ff497365636f6e644b6579a24966697273744c697374825f4131ff5f4132ff4a7365636f6e644c69737482a14874686972644b65795f4a746869726456616c7565ffa149666f757274684b65795f4b666f7572746856616c7565ff'
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
                'd87981a74c74726561737572795f6665651a000f42405074726561737572795f616464726573735f583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8ff4a707a5f6d696e5f6665651a000f42404c707a5f70726f766964657273815f583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8ff4f76616c69645f636f6e747261637473815f583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8ff4b61646d696e5f6372656473815f583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8ff5073657474696e67735f616464726573735f583930300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8ff'
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
                'a258383563613766346531653730386464663139353862326237653635313334373338656262613564386338303362646265353065613066336336a1400058383865643330633038306162613865623433316461626238303265613864646133613133316230663439633732643237363662323562316562a14000';
            const decoded = await decodeCborToJson(cbor);
            expect(decoded).toEqual({
                '5ca7f4e1e708ddf1958b2b7e65134738ebba5d8c803bdbe50ea0f3c6': {
                    '': 0
                },
                '8ed30c080aba8eb431dabb802ea8dda3a131b0f49c72d2766b25b1eb': {
                    '': 0
                }
            });
        });

        it('Should decode cbor that is an array of objects and not a 12(1-4) tag', async () => {
            const cbor =
                '82a158383563613766346531653730386464663139353862326237653635313334373338656262613564386338303362646265353065613066336336a1400081a158383865643330633038306162613865623433316461626238303265613864646133613133316230663439633732643237363662323562316562a14000';
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
                'd87981a74a707a5f6d696e5f6665651a000f42404b61646d696e5f63726564738158723330333030623163373939336431653266333330303763613234613030633937376439623138376435376537376530623866633662333434623833303062316337393933643165326633333030376361323461303063393737643962313837643537653737653062386663366233343462384c707a5f70726f7669646572738158723330333030623163373939336431653266333330303763613234613030633937376439623138376435376537376530623866633662333434623833303062316337393933643165326633333030376361323461303063393737643962313837643537653737653062386663366233343462384c74726561737572795f6665651a000f42404f76616c69645f636f6e7472616374738158723330333030623163373939336431653266333330303763613234613030633937376439623138376435376537376530623866633662333434623833303062316337393933643165326633333030376361323461303063393737643962313837643537653737653062386663366233343462385073657474696e67735f6164647265737358723330333030623163373939336431653266333330303763613234613030633937376439623138376435376537376530623866633662333434623833303062316337393933643165326633333030376361323461303063393737643962313837643537653737653062386663366233343462385074726561737572795f616464726573735872333033303062316337393933643165326633333030376361323461303063393737643962313837643537653737653062386663366233343462383330306231633739393364316532663333303037636132346130306339373764396231383764353765373765306238666336623334346238';
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
                            '30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8',
                        treasury_address:
                            '30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8',
                        treasury_fee: 1000000,
                        valid_contracts: [
                            '0x30300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8300b1c7993d1e2f33007ca24a00c977d9b187d57e77e0b8fc6b344b8'
                        ]
                    }
                ]
            });
        });
    });
});
