import { writeFileSync, unlinkSync } from 'fs';
import { HandleStore } from '.';
import { delay } from '../../../utils/util';
import { handlesFixture } from '../tests/fixtures/handles';
import { IPersonalization } from '@koralabs/handles-public-api-interfaces';
import { Logger } from '@koralabs/kora-labs-common';
import * as addresses from '../../../utils/addresses';
import * as config from '../../../config';

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

    beforeEach(async () => {
        HandleStore.setMetrics({ currentSlot: 1, lastSlot: 2 });
        jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);
        jest.spyOn(addresses, 'getAddressHolderDetails').mockReturnValue({
            address: 'stake123',
            type: 'base',
            knownOwnerName: 'unknown'
        });
        // populate storage
        for (const key in handlesFixture) {
            const handle = handlesFixture[key];
            const {
                hex,
                original_nft_image: image,
                name,
                og,
                utxo,
                updated_slot_number: slotNumber,
                resolved_addresses: { ada: adaAddress }
            } = handle;
            await HandleStore.saveMintedHandle({
                adaAddress,
                hex,
                image,
                name,
                og,
                slotNumber,
                utxo,
                datum: `some_datum_${key}`
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
                                background: '',
                                characters: 'letters',
                                created_slot_number: expect.any(Number),
                                datum: 'some_datum_0',
                                default_in_wallet: '',
                                hasDatum: true,
                                hex: 'barbacoa-hex',
                                holder_address: 'stake123',
                                length: 8,
                                name: 'barbacoa',
                                nft_image: '',
                                numeric_modifiers: '',
                                og: 0,
                                original_nft_image: '',
                                profile_pic: '',
                                rarity: 'basic',
                                resolved_addresses: { ada: '123' },
                                updated_slot_number: expect.any(Number),
                                utxo: 'utxo1#0'
                            }),
                            burrito: expect.objectContaining({
                                background: '',
                                characters: 'letters',
                                created_slot_number: expect.any(Number),
                                datum: 'some_datum_1',
                                default_in_wallet: '',
                                hasDatum: true,
                                hex: 'burrito-hex',
                                holder_address: 'stake123',
                                length: 7,
                                name: 'burrito',
                                nft_image: '',
                                numeric_modifiers: '',
                                og: 0,
                                original_nft_image: '',
                                profile_pic: '',
                                rarity: 'common',
                                resolved_addresses: { ada: '123' },
                                updated_slot_number: expect.any(Number),
                                utxo: 'utxo2#0'
                            }),
                            taco: expect.objectContaining({
                                background: '',
                                characters: 'letters',
                                created_slot_number: expect.any(Number),
                                datum: 'some_datum_2',
                                default_in_wallet: '',
                                hasDatum: true,
                                hex: 'taco-hex',
                                holder_address: 'stake123',
                                length: 4,
                                name: 'taco',
                                nft_image: '',
                                numeric_modifiers: '',
                                og: 0,
                                original_nft_image: '',
                                profile_pic: '',
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
                background: '',
                characters: 'letters',
                created_slot_number: expect.any(Number),
                datum: 'some_datum_0',
                default_in_wallet: 'taco',
                hasDatum: true,
                hex: 'barbacoa-hex',
                holder_address: 'stake123',
                length: 8,
                name: 'barbacoa',
                nft_image: '',
                numeric_modifiers: '',
                og: 0,
                original_nft_image: '',
                profile_pic: '',
                rarity: 'basic',
                resolved_addresses: { ada: '123' },
                updated_slot_number: expect.any(Number),
                utxo: 'utxo1#0',
                amount: 1
            });
        });
    });

    describe('saveMintedHandle tests', () => {
        it('Should save a new handle', async () => {
            const stakeKey = 'stake123';
            jest.spyOn(addresses, 'getAddressHolderDetails').mockReturnValue({
                address: stakeKey,
                type: 'base',
                knownOwnerName: 'unknown'
            });

            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);

            await HandleStore.saveMintedHandle({
                hex: 'nachos-hex',
                name: 'nachos',
                adaAddress: 'addr123',
                og: 0,
                utxo: 'utxo123#0',
                image: 'ipfs://123',
                slotNumber: 100,
                datum: 'datum123'
            });

            const handle = HandleStore.get('nachos');

            // expect to get the correct handle properties
            expect(handle).toEqual({
                background: '',
                characters: 'letters',
                created_slot_number: 100,
                default_in_wallet: 'taco',
                hex: 'nachos-hex',
                holder_address: 'stake123',
                length: 6,
                name: 'nachos',
                nft_image: 'ipfs://123',
                numeric_modifiers: '',
                og: 0,
                original_nft_image: 'ipfs://123',
                profile_pic: '',
                rarity: 'common',
                resolved_addresses: { ada: 'addr123' },
                updated_slot_number: 100,
                utxo: 'utxo123#0',
                hasDatum: true,
                datum: 'datum123',
                amount: 1
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
            const personalizationData = { nft_appearance: { handleTextShadowColor: 'todo' } };

            await HandleStore.savePersonalizationChange({
                hex: 'chimichanga-hex',
                name: 'chimichanga',
                slotNumber: 99,
                personalization: personalizationData,
                addresses: { ada: 'addr123' },
                setDefault: false
            });

            await HandleStore.saveMintedHandle({
                hex: 'chimichanga-hex',
                name: 'chimichanga',
                adaAddress: 'addr123',
                og: 0,
                utxo: 'utxo123#0',
                image: 'ipfs://123',
                slotNumber: 100
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
                                utxo: 'utxo123#0'
                            },
                            old: {
                                created_slot_number: 99,
                                default_in_wallet: 'taco',
                                resolved_addresses: { ada: '' },
                                updated_slot_number: 99,
                                utxo: ''
                            }
                        }
                    }
                ]
            ]);
        });
    });

    describe('savePersonalizationChange tests', () => {
        it('Should update personalization data', async () => {
            await HandleStore.saveMintedHandle({
                hex: 'nacho-cheese-hex',
                name: 'nacho-cheese',
                adaAddress: 'addr123',
                og: 0,
                utxo: 'utxo123#0',
                image: 'ipfs://123',
                slotNumber: 100
            });

            const personalizationUpdates: IPersonalization = {
                nft_appearance: {
                    handleTextShadowColor: 'todo',
                    handleTextBgColor: 'todo',
                    pfpImageUrl: 'todo',
                    pfpImageUrlEnabled: true,
                    pfpBorderColor: 'todo',
                    backgroundImageUrl: 'todo',
                    backgroundImageUrlEnabled: true,
                    backgroundColor: 'todo',
                    backgroundBorderColor: 'todo',
                    qrEnabled: true,
                    qrColor: 'todo',
                    socials: [],
                    socialsEnabled: true,
                    selectedAttributes: [],
                    purchasedAttributes: []
                }
            };

            await HandleStore.savePersonalizationChange({
                hex: 'nacho-cheese-hex',
                name: 'nacho-cheese',
                personalization: personalizationUpdates,
                addresses: {},
                slotNumber: 200,
                customImage: 'ipfs://123',
                setDefault: false
            });

            const handle = HandleStore.get('nacho-cheese');
            expect(handle?.default_in_wallet).toEqual('taco');
            expect(handle?.personalization).toEqual({
                nft_appearance: {
                    backgroundBorderColor: 'todo',
                    backgroundColor: 'todo',
                    backgroundImageUrl: 'todo',
                    backgroundImageUrlEnabled: true,
                    handleTextBgColor: 'todo',
                    handleTextShadowColor: 'todo',
                    pfpBorderColor: 'todo',
                    pfpImageUrl: 'todo',
                    pfpImageUrlEnabled: true,
                    purchasedAttributes: [],
                    qrColor: 'todo',
                    qrEnabled: true,
                    selectedAttributes: [],
                    socials: [],
                    socialsEnabled: true
                }
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
                                background: 'todo',
                                default_in_wallet: '',
                                personalization: {
                                    nft_appearance: {
                                        backgroundBorderColor: 'todo',
                                        backgroundColor: 'todo',
                                        backgroundImageUrl: 'todo',
                                        backgroundImageUrlEnabled: true,
                                        handleTextBgColor: 'todo',
                                        handleTextShadowColor: 'todo',
                                        pfpBorderColor: 'todo',
                                        pfpImageUrl: 'todo',
                                        pfpImageUrlEnabled: true,
                                        purchasedAttributes: [],
                                        qrColor: 'todo',
                                        qrEnabled: true,
                                        selectedAttributes: [],
                                        socials: [],
                                        socialsEnabled: true
                                    }
                                },
                                profile_pic: 'todo',
                                updated_slot_number: 200
                            },
                            old: {
                                background: '',
                                default_in_wallet: 'taco',
                                personalization: undefined,
                                profile_pic: '',
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
                nft_appearance: {
                    handleTextShadowColor: 'todo',
                    handleTextBgColor: 'todo',
                    pfpImageUrl: 'todo',
                    pfpImageUrlEnabled: true,
                    pfpBorderColor: 'todo',
                    backgroundImageUrl: 'todo',
                    backgroundImageUrlEnabled: true,
                    backgroundColor: 'todo',
                    backgroundBorderColor: 'todo',
                    qrEnabled: true,
                    qrColor: 'todo',
                    socials: [],
                    socialsEnabled: true,
                    selectedAttributes: [],
                    purchasedAttributes: []
                }
            };

            await HandleStore.savePersonalizationChange({
                hex: 'sour-cream-hex',
                name: 'sour-cream',
                personalization: personalizationUpdates,
                addresses: {},
                slotNumber: 200,
                setDefault: false
            });

            expect(saveSpy).toHaveBeenCalledWith({
                handle: {
                    background: '',
                    characters: 'letters,special',
                    created_slot_number: 200,
                    datum: undefined,
                    default_in_wallet: '',
                    hasDatum: false,
                    hex: 'sour-cream-hex',
                    holder_address: '',
                    length: 10,
                    name: 'sour-cream',
                    nft_image: '',
                    numeric_modifiers: '',
                    og: 0,
                    original_nft_image: '',
                    personalization: personalizationUpdates,
                    profile_pic: '',
                    rarity: 'basic',
                    resolved_addresses: { ada: '' },
                    updated_slot_number: 200,
                    utxo: '',
                    amount: 1
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
                og: 0,
                utxo: 'utxo123#0',
                image: '',
                slotNumber: 100
            });

            const personalizationUpdates: IPersonalization = {
                nft_appearance: {
                    handleTextShadowColor: '#000',
                    handleTextBgColor: '#CCC'
                }
            };

            await HandleStore.savePersonalizationChange({
                hex: handleHex,
                name: handleName,
                personalization: personalizationUpdates,
                addresses: {},
                slotNumber: 200,
                setDefault: true
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
                    type: 'base'
                })
            );

            expect([...(holderAddress?.handles ?? [])]).toEqual(
                expect.arrayContaining(['barbacoa', 'burrito', 'taco', 'tortilla-soup'])
            );
        });

        it('Should save default handle and history correctly when saving multiple times', async () => {
            const handleName = 'pork-belly';
            const handleHex = `${handleName}-hex`;
            await HandleStore.saveMintedHandle({
                hex: handleHex,
                name: handleName,
                adaAddress: 'addr123',
                og: 0,
                utxo: 'utxo123#0',
                image: '',
                slotNumber: 100
            });

            const personalizationUpdates: IPersonalization = {
                social_links: {
                    twitter: '@twitter_sauce'
                },
                nft_appearance: {
                    handleTextShadowColor: '#000',
                    handleTextBgColor: '#CCC'
                }
            };

            await HandleStore.savePersonalizationChange({
                hex: handleHex,
                name: handleName,
                personalization: personalizationUpdates,
                addresses: {},
                slotNumber: 200,
                setDefault: true
            });

            const handle = HandleStore.get(handleName);
            expect(handle?.personalization).toEqual(personalizationUpdates);
            expect(handle?.default_in_wallet).toEqual(handleName);

            const newPersonalizationUpdates: IPersonalization = {
                nft_appearance: {
                    handleTextShadowColor: '#EEE'
                }
            };

            await HandleStore.savePersonalizationChange({
                hex: handleHex,
                name: handleName,
                personalization: newPersonalizationUpdates,
                addresses: {},
                slotNumber: 300,
                setDefault: true
            });

            const updatedHandle = HandleStore.get(handleName);
            expect(updatedHandle?.personalization).toEqual(newPersonalizationUpdates);

            // Default in wallet should not change because it was not updated or removed.
            expect(updatedHandle?.default_in_wallet).toEqual(handleName);

            const PersonalizationUpdatesWithDefaultWalletChange: IPersonalization = {
                nft_appearance: {
                    handleTextShadowColor: '#111'
                }
            };

            await HandleStore.savePersonalizationChange({
                hex: handleHex,
                name: handleName,
                personalization: PersonalizationUpdatesWithDefaultWalletChange,
                addresses: {},
                slotNumber: 400,
                setDefault: false
            });

            const finalHandle = HandleStore.get(handleName);
            expect(finalHandle?.personalization).toEqual(PersonalizationUpdatesWithDefaultWalletChange);

            // Default should be changed because we removed it.
            expect(finalHandle?.default_in_wallet).toEqual('taco');

            // expect the first to be old null, meaning it was minted
            expect(Array.from(HandleStore.slotHistoryIndex)[3]).toEqual([
                100,
                { 'pork-belly': { new: { name: 'pork-belly' }, old: null } }
            ]);

            // expect the second to have the first pz updates.
            // personalization should be undefined because it was not set before
            expect(Array.from(HandleStore.slotHistoryIndex)[4]).toEqual([
                200,
                {
                    'pork-belly': {
                        new: {
                            default_in_wallet: 'pork-belly',
                            personalization: {
                                nft_appearance: { handleTextBgColor: '#CCC', handleTextShadowColor: '#000' },
                                social_links: { twitter: '@twitter_sauce' }
                            },
                            updated_slot_number: 200
                        },
                        old: { default_in_wallet: 'taco', personalization: undefined, updated_slot_number: 100 }
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
                                nft_appearance: { handleTextBgColor: undefined, handleTextShadowColor: '#EEE' },
                                social_links: undefined
                            },
                            updated_slot_number: 300
                        },
                        old: {
                            personalization: {
                                nft_appearance: { handleTextBgColor: '#CCC', handleTextShadowColor: '#000' },
                                social_links: { twitter: '@twitter_sauce' }
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
                            default_in_wallet: '',
                            personalization: {
                                nft_appearance: { handleTextShadowColor: '#111' }
                            },
                            updated_slot_number: 400
                        },
                        old: {
                            default_in_wallet: 'pork-belly',
                            personalization: {
                                nft_appearance: { handleTextShadowColor: '#EEE' }
                            },
                            updated_slot_number: 300
                        }
                    }
                }
            ]);
        });

        it('should save default handle properly', async () => {
            const tacoPzUpdate: IPersonalization = {
                nft_appearance: {
                    handleTextShadowColor: '#aaa'
                }
            };

            await HandleStore.savePersonalizationChange({
                hex: 'taco-hex',
                name: 'taco',
                personalization: tacoPzUpdate,
                addresses: {},
                slotNumber: 100,
                setDefault: false
            });

            const tacoHandle = HandleStore.get('taco');
            expect(tacoHandle?.default_in_wallet).toEqual('taco');

            const burritoPzUpdate: IPersonalization = {
                nft_appearance: {
                    handleTextShadowColor: '#aaa'
                }
            };

            await HandleStore.savePersonalizationChange({
                hex: 'burrito-hex',
                name: 'burrito',
                personalization: burritoPzUpdate,
                addresses: {},
                slotNumber: 200,
                setDefault: false
            });

            const burritoHandle = HandleStore.get('burrito');
            expect(burritoHandle?.default_in_wallet).toEqual('taco');

            const barbacoaPzUpdate: IPersonalization = {
                nft_appearance: {
                    handleTextShadowColor: '#aaa'
                }
            };

            await HandleStore.savePersonalizationChange({
                hex: 'barbacoa-hex',
                name: 'barbacoa',
                personalization: barbacoaPzUpdate,
                addresses: {},
                slotNumber: 300,
                setDefault: true
            });

            const barbacoaHandle = HandleStore.get('barbacoa');
            expect(barbacoaHandle?.default_in_wallet).toEqual('barbacoa');

            const tacoPzUpdate2: IPersonalization = {
                nft_appearance: {
                    handleTextShadowColor: '#aaa'
                }
            };

            await HandleStore.savePersonalizationChange({
                hex: 'taco-hex',
                name: 'taco',
                personalization: tacoPzUpdate2,
                addresses: {},
                slotNumber: 400,
                setDefault: false
            });

            const tacoHandle2 = HandleStore.get('taco');
            expect(tacoHandle2?.default_in_wallet).toEqual('barbacoa');
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
                    type: 'base',
                    knownOwnerName: 'unknown'
                })
                .mockReturnValueOnce({
                    address: updatedStakeKey,
                    type: 'base',
                    knownOwnerName: 'unknown'
                });

            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);

            await HandleStore.saveMintedHandle({
                hex: handleHex,
                name: handleName,
                adaAddress: address,
                og: 0,
                utxo: 'utxo_salsa1#0',
                image: 'ipfs://123',
                slotNumber: 100,
                datum: 'a2datum_salsa'
            });

            const existingHandle = HandleStore.get(handleName);
            expect(existingHandle?.resolved_addresses.ada).toEqual(address);
            expect(existingHandle?.holder_address).toEqual(stakeKey);

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
                holder_address: updatedStakeKey,
                default_in_wallet: 'taco',
                background: '',
                characters: 'letters',
                hex: handleHex,
                utxo: 'utxo_salsa2#0',
                length: 5,
                name: 'salsa',
                nft_image: 'ipfs://123',
                numeric_modifiers: '',
                og: 0,
                original_nft_image: 'ipfs://123',
                profile_pic: '',
                rarity: 'common',
                resolved_addresses: { ada: newAddress },
                created_slot_number: expect.any(Number),
                updated_slot_number: expect.any(Number),
                hasDatum: false
            });

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
                                holder_address: 'stake123_new',
                                resolved_addresses: {
                                    ada: 'addr123_new'
                                },
                                hasDatum: false,
                                datum: undefined,
                                updated_slot_number: 200,
                                utxo: 'utxo_salsa2#0'
                            },
                            old: {
                                holder_address: stakeKey,
                                resolved_addresses: { ada: address },
                                datum: 'a2datum_salsa',
                                updated_slot_number: 100,
                                utxo: 'utxo_salsa1#0',
                                hasDatum: true
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
                type: 'base'
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
                                hasDatum: true,
                                holder_address: 'stake123'
                            }
                        }
                    }
                ]
            ]);
        });
    });
});
