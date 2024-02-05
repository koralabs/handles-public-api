import { writeFileSync, unlinkSync } from 'fs';
import { HandleStore } from '.';
import { delay } from '../../../utils/util';
import { handlesFixture } from '../tests/fixtures/handles';
import { HandleType, IPersonalization, IPzDatum, IReferenceToken } from '@koralabs/kora-labs-common';
import { Logger } from '@koralabs/kora-labs-common';
import * as addresses from '../../../utils/addresses';
import * as config from '../../../config';
import * as serialization from '../../../utils/serialization';

jest.mock('fs', () => ({
    promises: {
        writeFile: jest.fn().mockImplementation(),
        readFile: jest.fn().mockImplementation(async (path, content) => {
            if (path.includes('taco.datum')) {
                return JSON.stringify({ utxo: '123#1', datum: 'abc123' });
            }

            return Promise.reject({ code: 'ENOENT', message: 'File not found' });
        }),
        unlink: jest.fn().mockImplementation(async () => Promise.reject({ code: 'ENOENT', message: 'File not found' }))
    },
    writeFileSync: jest.fn().mockImplementation(),
    unlinkSync: jest.fn().mockImplementation()
}));

jest.mock('cross-fetch');
jest.mock('proper-lockfile');
jest.mock('../../../utils/serialization');
jest.mock('../../../utils/addresses');

describe('HandleStore tests', () => {
    const filePath = 'storage/handles-test.json';
    const defaultReferenceToken: IReferenceToken = {
        tx_id: 'default_ref_tx',
        index: 0,
        lovelace: 0,
        datum: '',
        address: ''
    };
    beforeEach(async () => {
        HandleStore.setMetrics({ currentSlot: 1, lastSlot: 2 });
        jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);
        jest.spyOn(addresses, 'getAddressHolderDetails').mockReturnValue({
            address: 'stake123',
            type: '',
            knownOwnerName: 'unknown'
        });
        // populate storage
        for (const key in handlesFixture) {
            const handle = handlesFixture[key];
            const {
                hex,
                standard_image: image,
                name,
                og_number,
                utxo,
                updated_slot_number: slotNumber,
                resolved_addresses: { ada: adaAddress },
                image_hash,
                standard_image_hash,
                svg_version,
                type
            } = handle;
            await HandleStore.saveMintedHandle({
                adaAddress,
                hex,
                image,
                name,
                og_number,
                slotNumber,
                utxo,
                datum: `some_datum_${key}`,
                image_hash: standard_image_hash,
                svg_version,
                type
            });
        }
    });

    afterEach(async () => {
        const handles = HandleStore.getHandles().filter(Boolean);
        for (const handle of handles) {
            await HandleStore.remove(handle.name);
        }

        HandleStore.slotHistoryIndex = new Map();
        HandleStore.holderAddressIndex = new Map();

        jest.clearAllMocks();
    });

    beforeAll(async () => {
        // create test file
        writeFileSync(filePath, '{}');
    });

    afterAll(() => {
        unlinkSync(filePath);
    });

    describe('saveHandlesFile tests', () => {
        it('should save the file', async () => {
            const saveFileContentsSpy = jest.spyOn(HandleStore, 'saveFileContents').mockImplementation();
            await HandleStore.saveHandlesFile(123, 'some-hash', filePath, true);
            expect(saveFileContentsSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        handles: expect.objectContaining({
                            barbacoa: expect.objectContaining({
                                bg_image: '',
                                characters: 'letters',
                                created_slot_number: expect.any(Number),
                                datum: 'some_datum_0',
                                default_in_wallet: '',
                                has_datum: true,
                                hex: 'barbacoa-hex',
                                holder: 'stake123',
                                length: 8,
                                name: 'barbacoa',
                                image: '',
                                numeric_modifiers: '',
                                og_number: 0,
                                standard_image: '',
                                pfp_image: '',
                                rarity: 'basic',
                                resolved_addresses: { ada: '123' },
                                updated_slot_number: expect.any(Number),
                                utxo: 'utxo1#0'
                            }),
                            burrito: expect.objectContaining({
                                bg_image: '',
                                characters: 'letters',
                                created_slot_number: expect.any(Number),
                                datum: 'some_datum_1',
                                default_in_wallet: '',
                                has_datum: true,
                                hex: 'burrito-hex',
                                holder: 'stake123',
                                length: 7,
                                name: 'burrito',
                                image: '',
                                numeric_modifiers: '',
                                og_number: 0,
                                standard_image: '',
                                pfp_image: '',
                                rarity: 'common',
                                resolved_addresses: { ada: '123' },
                                updated_slot_number: expect.any(Number),
                                utxo: 'utxo2#0'
                            }),
                            taco: expect.objectContaining({
                                bg_image: '',
                                characters: 'letters',
                                created_slot_number: expect.any(Number),
                                datum: 'some_datum_2',
                                default_in_wallet: '',
                                has_datum: true,
                                hex: 'taco-hex',
                                holder: 'stake123',
                                length: 4,
                                name: 'taco',
                                image: '',
                                numeric_modifiers: '',
                                og_number: 0,
                                standard_image: '',
                                pfp_image: '',
                                rarity: 'common',
                                resolved_addresses: { ada: '123' },
                                updated_slot_number: expect.any(Number),
                                utxo: 'utxo3#0'
                            })
                        }),
                        history: [
                            [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                            [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                            [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }]
                        ]
                    }),
                    hash: 'some-hash',
                    slot: 123,
                    storagePath: 'storage/handles-test.json',
                    testDelay: true
                })
            );
        });

        it.skip('should not allow saving if file is locked', async () => {
            HandleStore.saveHandlesFile(123, 'some-hash', filePath, true);
            await delay(100);
            const saved = await HandleStore.saveHandlesFile(345, 'some-hash', filePath);
            await delay(1000);
            expect(saved).toEqual(false);
        });
    });

    describe.skip('getFile tests', () => {
        it('should not allow reading if file is locked', async () => {
            await HandleStore.saveHandlesFile(123, 'some-hash', filePath);
            const file = await HandleStore.getFile(filePath);
            expect(file).toEqual({
                slot: 123,
                hash: 'some-hash',
                schemaVersion: 1,
                handles: expect.any(Object)
            });
            HandleStore.saveHandlesFile(123, 'some-hash', filePath, true);
            await delay(100);
            const locked = await HandleStore.getFile(filePath);
            expect(locked).toEqual(null);
        });
    });

    describe('get', () => {
        it('should return a handle', () => {
            const handle = HandleStore.get('barbacoa');
            expect(handle).toEqual({
                bg_image: '',
                characters: 'letters',
                created_slot_number: expect.any(Number),
                datum: 'some_datum_0',
                default_in_wallet: 'taco',
                has_datum: true,
                hex: 'barbacoa-hex',
                holder: 'stake123',
                length: 8,
                name: 'barbacoa',
                image: '',
                image_hash: '',
                svg_version: '1.0.0',
                standard_image_hash: '',
                numeric_modifiers: '',
                og_number: 0,
                standard_image: '',
                pfp_image: '',
                rarity: 'basic',
                resolved_addresses: { ada: '123' },
                updated_slot_number: expect.any(Number),
                utxo: 'utxo1#0',
                amount: 1,
                holder_type: '',
                version: 0,
                type: HandleType.HANDLE
            });
        });
    });

    describe('getByHex', () => {
        it('should return a handle', () => {
            const handle = HandleStore.getByHex('barbacoa-hex');
            expect(handle?.name).toEqual('barbacoa');
        });
    });

    describe('saveMintedHandle tests', () => {
        it('Should save a new handle', async () => {
            const stakeKey = 'stake123';
            jest.spyOn(addresses, 'getAddressHolderDetails').mockReturnValue({
                address: stakeKey,
                type: '',
                knownOwnerName: 'unknown'
            });

            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);

            await HandleStore.saveMintedHandle({
                hex: 'nachos-hex',
                name: 'nachos',
                adaAddress: 'addr123',
                og_number: 0,
                utxo: 'utxo123#0',
                image: 'ipfs://123',
                slotNumber: 100,
                datum: 'datum123',
                image_hash: '0x123',
                svg_version: '1.0.0',
                type: HandleType.HANDLE
            });

            const handle = HandleStore.get('nachos');

            // expect to get the correct handle properties
            expect(handle).toEqual({
                bg_image: '',
                characters: 'letters',
                created_slot_number: 100,
                default_in_wallet: 'taco',
                hex: 'nachos-hex',
                holder: 'stake123',
                length: 6,
                name: 'nachos',
                image: 'ipfs://123',
                image_hash: '0x123',
                numeric_modifiers: '',
                og_number: 0,
                standard_image: 'ipfs://123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                pfp_image: '',
                rarity: 'common',
                resolved_addresses: { ada: 'addr123' },
                updated_slot_number: 100,
                utxo: 'utxo123#0',
                has_datum: true,
                datum: 'datum123',
                amount: 1,
                holder_type: '',
                version: 0,
                type: HandleType.HANDLE
            });

            // expect to get the correct slot history with all new handles
            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }],
                [expect.any(Number), { nachos: { new: { name: 'nachos' }, old: null } }]
            ]);
        });

        it('Should find existing handle and add personalization', async () => {
            const personalizationData: IPersonalization = {
                designer: {
                    font_shadow_color: '0xtodo'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const personalizationDatum: IPzDatum = {
                default: 0,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                resolved_addresses: { ada: '0x123', btc: '2213kjsjkn', eth: 'sad2wsad' },
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: 'chimichanga-hex',
                name: 'chimichanga',
                slotNumber: 99,
                personalization: personalizationData,
                reference_token: defaultReferenceToken,
                personalizationDatum,
                metadata: {
                    name: 'chimichanga',
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 10,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.HANDLE
                }
            });

            await HandleStore.saveMintedHandle({
                hex: 'chimichanga-hex',
                name: 'chimichanga',
                adaAddress: 'addr123',
                og_number: 0,
                utxo: 'utxo123#0',
                image: 'ipfs://123',
                slotNumber: 100,
                image_hash: '0xtodo',
                svg_version: '1.0.0',
                type: HandleType.HANDLE
            });

            const handle = HandleStore.get('chimichanga');

            // expect the personalization data to be added to the handle
            expect(handle?.personalization).toEqual(personalizationData);

            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }],
                [99, { chimichanga: { new: { name: 'chimichanga' }, old: null } }],
                [
                    100,
                    {
                        chimichanga: {
                            new: {
                                created_slot_number: 100,
                                default_in_wallet: '',
                                resolved_addresses: { ada: 'addr123' },
                                updated_slot_number: 100,
                                utxo: 'utxo123#0',
                                image_hash: '0xtodo',
                                standard_image_hash: '0xtodo',
                                reference_token: undefined
                            },
                            old: {
                                created_slot_number: 99,
                                default_in_wallet: 'taco',
                                resolved_addresses: { ada: '', btc: '2213kjsjkn', eth: 'sad2wsad' },
                                updated_slot_number: 99,
                                utxo: '',
                                image_hash: '0x123',
                                standard_image_hash: '0x123',
                                reference_token: defaultReferenceToken
                            }
                        }
                    }
                ]
            ]);
        });

        it('Should property update the amount property when another mint happens', async () => {
            const sushiHandle = 'sushi';
            const sushiHex = 'sushi-hex';
            await HandleStore.saveMintedHandle({
                hex: sushiHex,
                name: sushiHandle,
                adaAddress: 'addr123',
                og_number: 0,
                utxo: 'utxo123#0',
                image: 'ipfs://123',
                slotNumber: 100,
                datum: 'datum123',
                image_hash: '0x123',
                svg_version: '1.0.0',
                type: HandleType.HANDLE
            });

            await HandleStore.saveMintedHandle({
                hex: sushiHex,
                name: sushiHandle,
                adaAddress: 'addr1234',
                og_number: 0,
                utxo: 'utxo124#0',
                image: 'ipfs://123',
                slotNumber: 100,
                datum: 'datum123',
                image_hash: '0x123',
                svg_version: '1.0.0',
                type: HandleType.HANDLE
            });

            const handle = HandleStore.get(sushiHandle);
            expect(handle?.amount).toEqual(2);
        });

        it('Should save an NFT Sub Handle', async () => {
            const stakeKey = 'stake123';
            jest.spyOn(addresses, 'getAddressHolderDetails').mockReturnValue({
                address: stakeKey,
                type: '',
                knownOwnerName: 'unknown'
            });

            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);

            await HandleStore.saveMintedHandle({
                hex: '000de14073756240686e646c',
                name: 'sub@hndl',
                adaAddress: 'addr123',
                og_number: 0,
                utxo: 'utxo123#0',
                image: 'ipfs://123',
                slotNumber: 100,
                datum: 'datum123',
                image_hash: '0x123',
                svg_version: '1.0.0',
                type: HandleType.NFT_SUBHANDLE
            });

            const handle = HandleStore.get('sub@hndl');
            expect(handle?.name).toEqual('sub@hndl');
            expect(handle?.type).toEqual(HandleType.NFT_SUBHANDLE);
        });

        it('Should save an Virtual Sub Handle', async () => {
            const stakeKey = 'stake123';
            jest.spyOn(addresses, 'getAddressHolderDetails').mockReturnValue({
                address: stakeKey,
                type: '',
                knownOwnerName: 'unknown'
            });

            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);

            const handleName = 'virtual@hndl';

            await HandleStore.saveMintedHandle({
                hex: '000000007669727475616c40686e646c',
                name: handleName,
                adaAddress: 'addr123',
                og_number: 0,
                utxo: 'utxo123#0',
                image: 'ipfs://123',
                slotNumber: 100,
                datum: 'datum123',
                image_hash: '0x123',
                svg_version: '1.0.0',
                type: HandleType.VIRTUAL_SUBHANDLE
            });

            const handle = HandleStore.get(handleName);
            expect(handle?.type).toEqual(HandleType.VIRTUAL_SUBHANDLE);
        });
    });

    describe('savePersonalizationChange tests', () => {
        it('Should update personalization data', async () => {
            await HandleStore.saveMintedHandle({
                hex: 'nacho-cheese-hex',
                name: 'nacho-cheese',
                adaAddress: 'addr123',
                og_number: 0,
                utxo: 'utxo123#0',
                image: 'ipfs://123',
                slotNumber: 100,
                image_hash: '0x123',
                svg_version: '1.0.0',
                type: HandleType.HANDLE
            });

            const personalizationUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0xtodo',
                    text_ribbon_colors: ['0xtodo'],
                    pfp_border_color: '0xtodo',
                    bg_color: '0xtodo',
                    bg_border_color: '0xtodo',
                    qr_bg_color: '0xtodo',
                    socials: []
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const personalizationDatum: IPzDatum = {
                default: 0,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                resolved_addresses: { ada: '0xaaaa', btc: '2213kjsjkn', eth: 'sad2wsad' },
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: 'nacho-cheese-hex',
                name: 'nacho-cheese',
                personalization: personalizationUpdates,
                reference_token: defaultReferenceToken,
                slotNumber: 200,
                personalizationDatum,
                metadata: {
                    name: 'nacho-cheese',
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.HANDLE
                }
            });

            const handle = HandleStore.get('nacho-cheese');
            expect(handle?.default_in_wallet).toEqual('taco');
            expect(handle?.pfp_image).toEqual('todo');
            expect(handle?.bg_image).toEqual('todo');
            expect(handle?.resolved_addresses).toEqual({ ada: 'addr123', btc: '2213kjsjkn', eth: 'sad2wsad' });
            expect(handle?.personalization).toEqual({
                designer: {
                    bg_border_color: '0xtodo',
                    bg_color: '0xtodo',
                    font_shadow_color: '0xtodo',
                    pfp_border_color: '0xtodo',
                    qr_bg_color: '0xtodo',
                    socials: [],
                    text_ribbon_colors: ['0xtodo']
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            });

            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }],
                [100, { 'nacho-cheese': { new: { name: 'nacho-cheese' }, old: null } }],
                [
                    200,
                    {
                        'nacho-cheese': {
                            new: {
                                bg_image: 'todo',
                                default: false,
                                personalization: {
                                    designer: {
                                        bg_border_color: '0xtodo',
                                        bg_color: '0xtodo',
                                        font_shadow_color: '0xtodo',
                                        pfp_border_color: '0xtodo',
                                        qr_bg_color: '0xtodo',
                                        socials: [],
                                        text_ribbon_colors: ['0xtodo']
                                    },
                                    validated_by: 'todo',
                                    trial: false,
                                    nsfw: false
                                },
                                reference_token: defaultReferenceToken,
                                pfp_image: 'todo',
                                resolved_addresses: {
                                    btc: '2213kjsjkn',
                                    eth: 'sad2wsad'
                                },
                                updated_slot_number: 200
                            },
                            old: {
                                bg_image: '',
                                personalization: undefined,
                                reference_token: undefined,
                                pfp_image: '',
                                resolved_addresses: {
                                    ada: 'addr123'
                                },
                                updated_slot_number: 100
                            }
                        }
                    }
                ]
            ]);
        });

        it('Should update personalization data before 222 data', async () => {
            const saveSpy = jest.spyOn(HandleStore, 'save');
            const personalizationUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0xtodo',
                    text_ribbon_colors: ['0xtodo'],
                    pfp_border_color: '0xtodo',
                    bg_color: '0xtodo',
                    bg_border_color: '0xtodo',
                    qr_bg_color: '0xtodo',
                    socials: []
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const personalizationDatum: IPzDatum = {
                default: 0,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                resolved_addresses: { ada: '0xaaaa', btc: '2213kjsjkn', eth: 'sad2wsad' },
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: 'sour-cream-hex',
                name: 'sour-cream',
                personalization: personalizationUpdates,
                reference_token: defaultReferenceToken,
                personalizationDatum,
                slotNumber: 200,
                metadata: {
                    name: 'nacho-cheese',
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.HANDLE
                }
            });

            expect(saveSpy).toHaveBeenCalledWith({
                handle: {
                    bg_image: '',
                    characters: 'letters,special',
                    created_slot_number: 200,
                    datum: undefined,
                    default_in_wallet: '',
                    has_datum: false,
                    hex: 'sour-cream-hex',
                    holder: '',
                    length: 10,
                    name: 'sour-cream',
                    image: 'ipfs://123',
                    image_hash: '0x123',
                    numeric_modifiers: '',
                    og_number: 0,
                    standard_image: 'ipfs://123',
                    svg_version: '1.0.0',
                    standard_image_hash: '0x123',
                    personalization: personalizationUpdates,
                    reference_token: defaultReferenceToken,
                    script: undefined,
                    pfp_image: '',
                    rarity: 'basic',
                    resolved_addresses: { ada: '', btc: '2213kjsjkn', eth: 'sad2wsad' },
                    updated_slot_number: 200,
                    utxo: '',
                    amount: 1,
                    holder_type: '',
                    version: 0,
                    type: HandleType.HANDLE
                }
            });
        });

        it('Should update personalization data and save the default handle', async () => {
            const handleName = 'tortilla-soup';
            const handleHex = `${handleName}-hex`;
            await HandleStore.saveMintedHandle({
                hex: handleHex,
                name: handleName,
                adaAddress: 'addr123',
                og_number: 0,
                utxo: 'utxo123#0',
                image: '',
                slotNumber: 100,
                image_hash: '0x123',
                svg_version: '1.0.0',
                type: HandleType.HANDLE
            });

            const personalizationUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0x000',
                    text_ribbon_colors: ['0xCCC']
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const personalizationDatum: IPzDatum = {
                default: 1,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: handleHex,
                name: handleName,
                personalization: personalizationUpdates,
                reference_token: defaultReferenceToken,
                personalizationDatum,

                slotNumber: 200,
                metadata: {
                    name: 'nacho-cheese',
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.HANDLE
                }
            });

            const handle = HandleStore.get(handleName);

            // Expect the personalization data to be set
            // Expect the default_in_wallet to be set (this uses the getter in the HandleStore.get)
            expect(handle?.default_in_wallet).toEqual(handleName);
            expect(handle?.personalization).toEqual(personalizationUpdates);

            // Expect the handles array to have the new handle with defaultHandle and manuallySet true
            const holderAddress = HandleStore.holderAddressIndex.get('stake123');
            expect(holderAddress).toEqual(
                expect.objectContaining({
                    defaultHandle: 'tortilla-soup',
                    knownOwnerName: 'unknown',
                    manuallySet: true,
                    type: ''
                })
            );

            expect([...(holderAddress?.handles ?? [])]).toEqual(expect.arrayContaining(['barbacoa', 'burrito', 'taco', 'tortilla-soup']));
        });

        it('Should save default handle and history correctly when saving multiple times', async () => {
            const handleName = 'pork-belly';
            const handleHex = `${handleName}-hex`;
            await HandleStore.saveMintedHandle({
                hex: handleHex,
                name: handleName,
                adaAddress: 'addr123',
                og_number: 0,
                utxo: 'utxo123#0',
                image: '',
                slotNumber: 100,
                image_hash: '0x123',
                svg_version: '1.0.0',
                type: HandleType.HANDLE
            });

            const personalizationUpdates: IPersonalization = {
                socials: [
                    {
                        display: '@twitter_sauce',
                        url: 'https://twitter.com/twitter_sauce'
                    }
                ],
                designer: {
                    font_shadow_color: '0x000',
                    text_ribbon_colors: ['0xCCC']
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const personalizationDatum: IPzDatum = {
                default: 1,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: handleHex,
                name: handleName,
                personalization: personalizationUpdates,
                reference_token: defaultReferenceToken,
                personalizationDatum,

                slotNumber: 200,
                metadata: {
                    name: 'nacho-cheese',
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.HANDLE
                }
            });

            const handle = HandleStore.get(handleName);
            expect(handle?.personalization).toEqual(personalizationUpdates);
            expect(handle?.default_in_wallet).toEqual(handleName);

            const newPersonalizationUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0xEEE'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const newPersonalizationDatum: IPzDatum = {
                default: 1,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: handleHex,
                name: handleName,
                personalization: newPersonalizationUpdates,
                reference_token: defaultReferenceToken,
                personalizationDatum: newPersonalizationDatum,

                slotNumber: 300,
                metadata: {
                    name: 'nacho-cheese',
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.HANDLE
                }
            });

            const updatedHandle = HandleStore.get(handleName);
            expect(updatedHandle?.personalization).toEqual(newPersonalizationUpdates);

            // Default in wallet should not change because it was not updated or removed.
            expect(updatedHandle?.default_in_wallet).toEqual(handleName);
            const referenceUpdatesWithDefaultWalletChange: IReferenceToken = {
                tx_id: '',
                index: 0,
                lovelace: 0,
                datum: '',
                address: ''
            };
            const personalizationUpdatesWithDefaultWalletChange: IPersonalization = {
                designer: {
                    font_shadow_color: '0x111'
                },
                validated_by: 'new',
                trial: false,
                nsfw: false
            };

            const finalPersonalizationDatum: IPzDatum = {
                default: 0,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: handleHex,
                name: handleName,
                personalization: personalizationUpdatesWithDefaultWalletChange,
                reference_token: defaultReferenceToken,
                personalizationDatum: finalPersonalizationDatum,

                slotNumber: 400,
                metadata: {
                    name: handleName,
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.HANDLE
                }
            });

            const finalHandle = HandleStore.get(handleName);
            expect(finalHandle?.personalization).toEqual(personalizationUpdatesWithDefaultWalletChange);

            // Default should be changed because we removed it.
            expect(finalHandle?.default_in_wallet).toEqual('taco');

            // expect the first to be old null, meaning it was minted
            expect(Array.from(HandleStore.slotHistoryIndex)[3]).toEqual([100, { 'pork-belly': { new: { name: 'pork-belly' }, old: null } }]);

            // expect the second to have the first pz updates.
            // personalization should be undefined because it was not set before
            expect(Array.from(HandleStore.slotHistoryIndex)[4]).toEqual([
                200,
                {
                    'pork-belly': {
                        new: {
                            bg_image: 'todo',
                            pfp_image: 'todo',
                            default: true,
                            image: 'ipfs://123',
                            personalization: {
                                designer: {
                                    font_shadow_color: '0x000',
                                    text_ribbon_colors: ['0xCCC']
                                },
                                socials: [{ display: '@twitter_sauce', url: 'https://twitter.com/twitter_sauce' }],
                                validated_by: 'todo',
                                trial: false,
                                nsfw: false
                            },
                            reference_token: defaultReferenceToken,
                            updated_slot_number: 200
                        },
                        old: {
                            bg_image: '',
                            pfp_image: '',
                            image: '',
                            personalization: undefined,
                            reference_token: undefined,
                            updated_slot_number: 100
                        }
                    }
                }
            ]);

            // expect the third to have the second pz updates which didn't include social links
            expect(Array.from(HandleStore.slotHistoryIndex)[5]).toEqual([
                300,
                {
                    'pork-belly': {
                        new: {
                            personalization: {
                                designer: { font_shadow_color: '0xEEE', text_ribbon_colors: undefined },
                                socials: undefined
                            },
                            updated_slot_number: 300
                        },
                        old: {
                            personalization: {
                                designer: {
                                    font_shadow_color: '0x000',
                                    text_ribbon_colors: ['0xCCC']
                                },
                                socials: [{ display: '@twitter_sauce', url: 'https://twitter.com/twitter_sauce' }],
                                validated_by: 'todo',
                                trial: false,
                                nsfw: false
                            },
                            updated_slot_number: 200
                        }
                    }
                }
            ]);

            // expect the fourth to have the last pz updates default handle should have been removed
            expect(Array.from(HandleStore.slotHistoryIndex)[6]).toEqual([
                400,
                {
                    'pork-belly': {
                        new: {
                            default: false,
                            personalization: { designer: { font_shadow_color: '0x111' }, validated_by: 'new' },
                            updated_slot_number: 400
                        },
                        old: {
                            default: true,
                            personalization: {
                                designer: {
                                    font_shadow_color: '0xEEE'
                                },
                                validated_by: 'todo',
                                nsfw: false,
                                trial: false
                            },
                            updated_slot_number: 300
                        }
                    }
                }
            ]);
        });

        it('should save default handle properly', async () => {
            const tacoPzUpdate: IPersonalization = {
                designer: {
                    font_shadow_color: '0xaaa'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const tacoPersonalizationDatum: IPzDatum = {
                default: 0,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: 'taco-hex',
                name: 'taco',
                personalization: tacoPzUpdate,
                reference_token: defaultReferenceToken,
                personalizationDatum: tacoPersonalizationDatum,

                slotNumber: 100,
                metadata: {
                    name: 'taco',
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.HANDLE
                }
            });

            const tacoHandle = HandleStore.get('taco');
            expect(tacoHandle?.default_in_wallet).toEqual('taco');
            const burritoPzUpdate: IPersonalization = {
                designer: {
                    font_shadow_color: '0xaaa'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const burritoPersonalizationDatum: IPzDatum = {
                default: 0,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: 'burrito-hex',
                name: 'burrito',
                personalization: burritoPzUpdate,
                reference_token: defaultReferenceToken,
                personalizationDatum: burritoPersonalizationDatum,

                slotNumber: 200,
                metadata: {
                    name: 'burrito',
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.HANDLE
                }
            });

            const burritoHandle = HandleStore.get('burrito');
            expect(burritoHandle?.default_in_wallet).toEqual('taco');
            const barbacoaPzUpdate: IPersonalization = {
                designer: {
                    font_shadow_color: '0xaaa'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const barbacoaPersonalizationDatum: IPzDatum = {
                default: 1,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: 'barbacoa-hex',
                name: 'barbacoa',
                personalization: barbacoaPzUpdate,
                reference_token: defaultReferenceToken,
                personalizationDatum: barbacoaPersonalizationDatum,

                slotNumber: 300,
                metadata: {
                    name: 'barbacoa',
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.HANDLE
                }
            });

            const barbacoaHandle = HandleStore.get('barbacoa');
            expect(barbacoaHandle?.default_in_wallet).toEqual('barbacoa');
            const tacoPzUpdate2: IPersonalization = {
                designer: {
                    font_shadow_color: '0xaaa'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const tacoPersonalizationDatumUpdate2: IPzDatum = {
                default: 0,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: 'taco-hex',
                name: 'taco',
                personalization: tacoPzUpdate2,
                reference_token: defaultReferenceToken,
                personalizationDatum: tacoPersonalizationDatumUpdate2,

                slotNumber: 400,
                metadata: {
                    name: 'taco',
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.HANDLE
                }
            });

            const tacoHandle2 = HandleStore.get('taco');
            expect(tacoHandle2?.default_in_wallet).toEqual('barbacoa');
        });

        it('should save details for nft handle', async () => {
            const handleName = 'nft@hndl';
            const handleHex = `${handleName}-hex`;
            await HandleStore.saveMintedHandle({
                hex: handleHex,
                name: handleName,
                adaAddress: 'addr123',
                og_number: 0,
                utxo: 'utxo123#0',
                image: '',
                slotNumber: 100,
                image_hash: '0x123',
                svg_version: '1.0.0',
                type: HandleType.NFT_SUBHANDLE
            });

            const personalizationUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0x000000'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const personalizationDatum: IPzDatum = {
                default: 0,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: handleHex,
                name: handleName,
                personalization: personalizationUpdates,
                reference_token: defaultReferenceToken,
                personalizationDatum,

                slotNumber: 300,
                metadata: {
                    name: handleHex,
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.NFT_SUBHANDLE
                }
            });

            const nftSubHandle = HandleStore.get(handleName);
            expect(nftSubHandle?.personalization).toEqual(personalizationUpdates);
            expect(nftSubHandle?.type).toEqual(HandleType.NFT_SUBHANDLE);
        });

        it('should save details for virtual handle', async () => {
            const bech32FromHexSpy = jest.spyOn(serialization, 'bech32FromHex');

            const handleName = 'virtual@hndl';
            const handleHex = '000000007669727475616c40686e646c';

            const personalizationUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0x000000'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const personalizationDatum: IPzDatum = {
                default: 0,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                resolved_addresses: {
                    ada: '0x000b7436f6c86f362580f313cfef7916ac2b8769483741c452f410b4e5557ddf7f3475194f6d41ce9449230a344d5500cef9864d3676fb140a'
                },
                svg_version: '1.0.0',
                standard_image: '',
                portal: '',
                designer: '',
                socials: '',
                vendor: '',
                last_update_address: '',
                validated_by: '',
                trial: 0,
                nsfw: 0,
                agreed_terms: '',
                migrate_sig_required: 0
            };

            await HandleStore.savePersonalizationChange({
                hex: handleHex,
                name: handleName,
                personalization: personalizationUpdates,
                reference_token: defaultReferenceToken,
                personalizationDatum,

                slotNumber: 300,
                metadata: {
                    name: handleHex,
                    image: 'ipfs://123',
                    mediaType: 'image/jpeg',
                    og_number: 0,
                    rarity: 'todo',
                    length: 2,
                    characters: 'todo',
                    numeric_modifiers: 'todo',
                    version: 0,
                    og: 0,
                    handle_type: HandleType.VIRTUAL_SUBHANDLE
                }
            });

            const virtualSubHandle = HandleStore.get(handleName);
            expect(virtualSubHandle?.personalization).toEqual(personalizationUpdates);

            // expect virtual sub handle utxo to be the utxo of the reference token
            expect(virtualSubHandle?.utxo).toEqual(`${defaultReferenceToken.tx_id}#${defaultReferenceToken.index}`);

            // expect the ada address to be the bech32 encoded version of the reference token address
            expect(bech32FromHexSpy).toHaveBeenCalledWith(personalizationDatum.resolved_addresses?.ada.replace('0x', ''), true);

            expect(virtualSubHandle?.type).toEqual(HandleType.VIRTUAL_SUBHANDLE);
        });
    });

    describe('saveHandleUpdate tests', () => {
        it('Should update a handle and the slot history', async () => {
            const handleHex = 'salsa-hex';
            const handleName = 'salsa';
            const stakeKey = 'stake123';
            const updatedStakeKey = 'stake123_new';
            const address = 'addr123';
            const newAddress = 'addr123_new';
            jest.spyOn(addresses, 'getAddressHolderDetails')
                .mockReturnValueOnce({
                    address: stakeKey,
                    type: '',
                    knownOwnerName: 'unknown'
                })
                .mockReturnValueOnce({
                    address: updatedStakeKey,
                    type: '',
                    knownOwnerName: 'unknown'
                });

            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);

            await HandleStore.saveMintedHandle({
                hex: handleHex,
                name: handleName,
                adaAddress: address,
                og_number: 0,
                utxo: 'utxo_salsa1#0',
                image: 'ipfs://123',
                slotNumber: 100,
                datum: 'a2datum_salsa',
                image_hash: '0x123',
                svg_version: '1.0.0',
                type: HandleType.HANDLE
            });

            const existingHandle = HandleStore.get(handleName);
            expect(existingHandle?.resolved_addresses.ada).toEqual(address);
            expect(existingHandle?.holder).toEqual(stakeKey);

            const holderAddress = HandleStore.holderAddressIndex.get(stakeKey);
            expect(holderAddress?.handles?.has(handleName)).toBeTruthy();

            await HandleStore.saveHandleUpdate({
                name: handleName,
                adaAddress: newAddress,
                utxo: 'utxo_salsa2#0',
                slotNumber: 200,
                datum: undefined
            });

            const handle = HandleStore.get(handleName);
            expect(handle).toEqual({
                amount: 1,
                holder: updatedStakeKey,
                bg_image: '',
                characters: 'letters',
                hex: handleHex,
                utxo: 'utxo_salsa2#0',
                length: 5,
                name: 'salsa',
                image: 'ipfs://123',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                numeric_modifiers: '',
                og_number: 0,
                standard_image: 'ipfs://123',
                pfp_image: '',
                rarity: 'common',
                resolved_addresses: { ada: newAddress },
                created_slot_number: expect.any(Number),
                updated_slot_number: expect.any(Number),
                has_datum: false,
                holder_type: '',
                version: 0,
                type: HandleType.HANDLE,
                default_in_wallet: 'salsa'
            });

            const newHolderAddress = HandleStore.holderAddressIndex.get(updatedStakeKey);
            expect([...(newHolderAddress?.handles ?? [])]).toEqual([handleName]);

            // expect the handle to be removed from the old holder
            const updatedHolderAddress = HandleStore.holderAddressIndex.get(stakeKey);
            expect(updatedHolderAddress?.handles?.has(handleName)).toBeFalsy();

            // expect to get the correct slot history with all new handles
            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }],
                [100, { [handleName]: { new: { name: 'salsa' }, old: null } }],
                [
                    200,
                    {
                        [handleName]: {
                            new: {
                                holder: 'stake123_new',
                                resolved_addresses: {
                                    ada: 'addr123_new'
                                },
                                has_datum: false,
                                datum: undefined,
                                updated_slot_number: 200,
                                utxo: 'utxo_salsa2#0'
                            },
                            old: {
                                holder: stakeKey,
                                resolved_addresses: { ada: address },
                                datum: 'a2datum_salsa',
                                updated_slot_number: 100,
                                utxo: 'utxo_salsa1#0',
                                has_datum: true
                            }
                        }
                    }
                ]
            ]);
        });

        it('Should log an error if handle is not found', async () => {
            const loggerSpy = jest.spyOn(Logger, 'log');

            const newAddress = 'addr123_new';
            await HandleStore.saveHandleUpdate({
                name: 'not-a-handle',
                adaAddress: newAddress,
                slotNumber: 1234,
                utxo: 'utxo'
            });
            expect(loggerSpy).toHaveBeenCalledWith({
                category: 'ERROR',
                event: 'saveHandleUpdate.noHandleFound',
                message: 'Handle was updated but there is no existing handle in storage with name: not-a-handle'
            });
        });
    });

    describe('burnHandle tests', () => {
        it('Should burn a handle, update history and update the default handle', async () => {
            const handleName = 'taco';
            await HandleStore.burnHandle(handleName, 200);

            // After burn, expect not to find the handle
            const handle = HandleStore.get(handleName);
            expect(handle).toEqual(null);

            // Once a handle is burned, expect it to be removed from the holderAddressIndex and a NEW defaultHandle set
            expect(HandleStore.holderAddressIndex.get('stake123')).toEqual({
                defaultHandle: 'burrito',
                handles: new Set(['barbacoa', 'burrito']),
                knownOwnerName: 'unknown',
                manuallySet: false,
                type: ''
            });

            // expect history to include the burn details. new is null, old is the entire handle.
            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }],
                [
                    200,
                    {
                        [handleName]: {
                            new: null,
                            old: {
                                ...handlesFixture[2],
                                datum: 'some_datum_2',
                                has_datum: true,
                                holder: 'stake123'
                            }
                        }
                    }
                ]
            ]);
        });
    });
});
