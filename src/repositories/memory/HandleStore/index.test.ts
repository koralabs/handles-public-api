import { writeFileSync, unlinkSync } from 'fs';
import { HandleStore } from '.';
import { delay } from '../../../utils/util';
import { handlesFixture } from '../tests/fixtures/handles';
import { IPersonalization } from '@koralabs/handles-public-api-interfaces';
import { Logger } from '@koralabs/kora-labs-common';
import * as addresses from '../../../utils/addresses';

jest.mock('fs');
jest.mock('cross-fetch');
jest.mock('proper-lockfile');
jest.mock('../../../utils/serialization');
jest.mock('../../../utils/addresses');

describe('HandleStore tests', () => {
    const filePath = 'storage/handles-test.json';

    beforeEach(async () => {
        jest.spyOn(addresses, 'getAddressHolderDetails').mockResolvedValue({
            address: 'stake123',
            type: 'base',
            knownOwnerName: 'unknown'
        });
        // populate storage
        for (const key in handlesFixture) {
            const handle = handlesFixture[key];
            const {
                hex: hexName,
                original_nft_image: image,
                name,
                og,
                updated_slot_number: slotNumber,
                resolved_addresses: { ada: adaAddress }
            } = handle;
            await HandleStore.saveMintedHandle({ adaAddress, hexName, image, name, og, slotNumber });
        }
    });

    afterEach(() => {
        for (const key in handlesFixture) {
            const handle = handlesFixture[key];
            HandleStore.remove(handle.hex);
        }

        HandleStore.slotHistoryIndex = new Map();

        jest.clearAllMocks();
    });

    beforeAll(async () => {
        // create test file
        writeFileSync(filePath, '{}');
    });

    afterAll(() => {
        unlinkSync(filePath);
    });

    describe.skip('saveHandlesFile tests', () => {
        it('should not allow saving if file is locked', async () => {
            HandleStore.saveHandlesFile(123, 'some-hash', filePath, async () => {
                await delay(1000);
            });
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
            HandleStore.saveHandlesFile(123, 'some-hash', filePath, async () => {
                await delay(1000);
            });
            await delay(100);
            const locked = await HandleStore.getFile(filePath);
            expect(locked).toEqual(null);
        });
    });

    describe('saveMintedHandle tests', () => {
        it('Should save a new handle', async () => {
            const stakeKey = 'stake123';
            jest.spyOn(addresses, 'getAddressHolderDetails').mockResolvedValue({
                address: stakeKey,
                type: 'base',
                knownOwnerName: 'unknown'
            });

            await HandleStore.saveMintedHandle({
                hexName: 'nachos-hex',
                name: 'nachos',
                adaAddress: 'addr123',
                og: 0,
                image: 'ipfs://123',
                slotNumber: 100
            });

            const handle = HandleStore.get('nachos-hex');

            // expect to get the correct handle properties
            expect(handle).toEqual({
                background: '',
                holder_address: 'stake123',
                default_in_wallet: 'taco',
                characters: 'letters',
                hex: 'nachos-hex',
                length: 6,
                name: 'nachos',
                nft_image: 'ipfs://123',
                numeric_modifiers: '',
                og: 0,
                original_nft_image: 'ipfs://123',
                profile_pic: '',
                rarity: 'common',
                resolved_addresses: { ada: 'addr123' },
                created_slot_number: expect.any(Number),
                updated_slot_number: expect.any(Number)
            });

            // expect to get the correct slot history with all new handles
            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { 'barbacoa-hex': { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { 'burrito-hex': { new: { name: 'burritos' }, old: null } }],
                [expect.any(Number), { 'taco-hex': { new: { name: 'taco' }, old: null } }],
                [expect.any(Number), { 'nachos-hex': { new: { name: 'nachos' }, old: null } }]
            ]);
        });
    });

    describe('savePersonalizationChange tests', () => {
        it('Should update personalization data', async () => {
            await HandleStore.saveMintedHandle({
                hexName: 'nachos-hex',
                name: 'nachos',
                adaAddress: 'addr123',
                og: 0,
                image: 'ipfs://123',
                slotNumber: 100
            });

            const personalizationUpdates: IPersonalization = {
                nft_appearance: {
                    image: 'todo',
                    background: 'todo',
                    profilePic: 'todo',
                    theme: 'todo',
                    textBackground: 'todo',
                    border: 'todo',
                    trimColor: 'todo',
                    selectedAttributes: [],
                    purchasedAttributes: []
                }
            };

            await HandleStore.savePersonalizationChange({
                hexName: 'nachos-hex',
                personalization: personalizationUpdates,
                addresses: {},
                slotNumber: 200
            });

            const personalization = HandleStore.getPersonalization('nachos-hex');
            expect(personalization).toEqual({
                nft_appearance: {
                    background: 'todo',
                    border: 'todo',
                    image: 'todo',
                    profilePic: 'todo',
                    purchasedAttributes: [],
                    selectedAttributes: [],
                    textBackground: 'todo',
                    theme: 'todo',
                    trimColor: 'todo'
                }
            });

            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { 'barbacoa-hex': { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { 'burrito-hex': { new: { name: 'burritos' }, old: null } }],
                [expect.any(Number), { 'taco-hex': { new: { name: 'taco' }, old: null } }],
                // expect the initial create
                [100, { 'nachos-hex': { new: { name: 'nachos' }, old: null } }],
                // expect the personalization update
                [
                    200,
                    {
                        'nachos-hex': {
                            new: {
                                background: 'todo',
                                default_in_wallet: '',
                                nft_image: 'todo',
                                profile_pic: 'todo',
                                updated_slot_number: 200
                            },
                            old: {
                                background: '',
                                default_in_wallet: 'taco',
                                nft_image: 'ipfs://123',
                                profile_pic: '',
                                updated_slot_number: 100
                            }
                        }
                    }
                ]
            ]);
        });

        it('Should log an error if handle is not found', async () => {
            const loggerSpy = jest.spyOn(Logger, 'log');

            const personalization: IPersonalization = {};
            await HandleStore.savePersonalizationChange({
                hexName: '123',
                personalization,
                addresses: {},
                slotNumber: 1234
            });
            expect(loggerSpy).toHaveBeenCalledWith({
                category: 'ERROR',
                event: 'saveWalletAddressMove.noHandleFound',
                message: 'Wallet moved, but there is no existing handle in storage with hex: 123'
            });
        });
    });

    describe('saveWalletAddressMove tests', () => {
        it('Should only update the ada address', async () => {
            const stakeKey = 'stake123';
            const updatedStakeKey = 'stake123_new';
            const address = 'addr123';
            const newAddress = 'addr123_new';
            jest.spyOn(addresses, 'getAddressHolderDetails')
                .mockResolvedValueOnce({
                    address: stakeKey,
                    type: 'base',
                    knownOwnerName: 'unknown'
                })
                .mockResolvedValueOnce({
                    address: updatedStakeKey,
                    type: 'base',
                    knownOwnerName: 'unknown'
                });

            await HandleStore.saveMintedHandle({
                hexName: 'salsa-hex',
                name: 'salsa',
                adaAddress: address,
                og: 0,
                image: 'ipfs://123',
                slotNumber: 100
            });

            const existingHandle = HandleStore.get('salsa-hex');
            expect(existingHandle?.resolved_addresses.ada).toEqual(address);
            expect(existingHandle?.holder_address).toEqual(stakeKey);

            await HandleStore.saveWalletAddressMove({
                hexName: 'salsa-hex',
                adaAddress: newAddress,
                slotNumber: 200
            });

            const handle = HandleStore.get('salsa-hex');
            expect(handle).toEqual({
                holder_address: updatedStakeKey,
                default_in_wallet: 'salsa',
                background: '',
                characters: 'letters',
                hex: 'salsa-hex',
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
                updated_slot_number: expect.any(Number)
            });

            // expect to get the correct slot history with all new handles
            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { 'barbacoa-hex': { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { 'burrito-hex': { new: { name: 'burritos' }, old: null } }],
                [expect.any(Number), { 'taco-hex': { new: { name: 'taco' }, old: null } }],
                [100, { 'salsa-hex': { new: { name: 'salsa' }, old: null } }],
                [
                    200,
                    {
                        'salsa-hex': {
                            new: {
                                holder_address: 'stake123_new',
                                resolved_addresses: {
                                    ada: 'addr123_new'
                                },
                                updated_slot_number: 200
                            },
                            old: {
                                holder_address: stakeKey,
                                resolved_addresses: { ada: address },
                                updated_slot_number: 100
                            }
                        }
                    }
                ]
            ]);
        });

        it('Should log an error if handle is not found', async () => {
            const loggerSpy = jest.spyOn(Logger, 'log');
            jest.spyOn(HandleStore, 'get').mockReturnValue(null);

            const newAddress = 'addr123_new';
            await HandleStore.saveWalletAddressMove({ hexName: '123', adaAddress: newAddress, slotNumber: 1234 });
            expect(loggerSpy).toHaveBeenCalledWith({
                category: 'ERROR',
                event: 'saveWalletAddressMove.noHandleFound',
                message: 'Wallet moved, but there is no existing handle in storage with hex: 123'
            });
        });
    });
});
