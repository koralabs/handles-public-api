import { decodeJsonDatumToJson, encodeJsonToDatum } from './index';

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
        'd87983aa426f67f4446e616d6548786172313233343545696d61676550697066733a2f2f696d6167655f636964466c656e67746808467261726974794562617369634776657273696f6e01496d656469615479706549696d6167652f706e67496f675f6e756d626572004e6368617261637465725f7479706552636861726163746572732c6e756d62657273506e756d657269635f6d6f6469666965724001d87981a846686f6c646572497374616b65312e2e2e4676656e646f724a697066733a2f2f6369644764656661756c74f547736f6369616c734a697066733a2f2f6369644862675f696d6167654a697066733a2f2f6369644873657474696e67734a697066733a2f2f636964497066705f696d6167654a697066733a2f2f6369644c637573746f6d5f696d6167654a697066733a2f2f636964';

    const json = {
        firstKey: 'firstValue',
        secondKey: {
            firstList: ['1', '2'],
            secondList: [{ thirdKey: 'thirdValue' }, { fourthKey: 'fourthValue' }]
        }
    };

    describe('encodeJsonToDatum tests', () => {
        it('Should convert from JSON to PlutusDataCbor', () => {
            const encoded = encodeJsonToDatum(plutusDataJson);
            expect(encoded).toEqual(expectedCbor);
        });

        it('Should convert from JSON to TxMetadataJson', () => {
            const encoded = encodeJsonToDatum(json);
            expect(encoded).toEqual(
                'a24866697273744b65794a666972737456616c7565497365636f6e644b6579a24966697273744c69737482413141324a7365636f6e644c69737482a14874686972644b65794a746869726456616c7565a149666f757274684b65794b666f7572746856616c7565'
            );
        });
    });

    describe('decodeJsonDatumToJson tests', () => {
        it('Should convert from PlutusDataCbor to JSON', () => {
            const decoded = decodeJsonDatumToJson(expectedCbor);
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

        it.skip('Should convert from TxMetadataJson to JSON', () => {
            // TODO: Finish decoding TxMetadataJson to JSON
            const cbor =
                'a24866697273744b65794a666972737456616c7565497365636f6e644b6579a24966697273744c69737482413141324a7365636f6e644c69737482a14874686972644b65794a746869726456616c7565a149666f757274684b65794b666f7572746856616c7565';
            const decoded = decodeJsonDatumToJson(cbor);
            expect(decoded).toEqual(null);
        });
    });
});
