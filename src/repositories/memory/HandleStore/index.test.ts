import { writeFileSync, unlinkSync } from 'fs';
import { HandleStore } from '.';
import { delay } from '../../../utils/util';
import { handlesFixture, slotHistoryFixture } from '../tests/fixtures/handles';
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

        // set the slotHistoryIndex
        HandleStore.slotHistoryIndex = new Map(
            Object.keys(slotHistoryFixture).map((k) => {
                const slot = parseInt(k);
                return [slot, slotHistoryFixture[slot]];
            })
        );
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

    describe.skip('saveFile tests', () => {
        it('should not allow saving if file is locked', async () => {
            HandleStore.saveFile(123, 'some-hash', filePath, async () => {
                await delay(1000);
            });
            await delay(100);
            const saved = await HandleStore.saveFile(345, 'some-hash', filePath);
            await delay(1000);
            expect(saved).toEqual(false);
        });
    });

    describe.skip('getFile tests', () => {
        it('should not allow reading if file is locked', async () => {
            await HandleStore.saveFile(123, 'some-hash', filePath);
            const file = await HandleStore.getFile(filePath);
            expect(file).toEqual({
                slot: 123,
                hash: 'some-hash',
                schemaVersion: 1,
                handles: expect.any(Object)
            });
            HandleStore.saveFile(123, 'some-hash', filePath, async () => {
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
                slotNumber: 1234
            });
            const handle = HandleStore.get('nachos-hex');
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
        });
    });

    describe('savePersonalizationChange tests', () => {
        it('Should update personalization data', async () => {
            HandleStore.saveMintedHandle({
                hexName: 'nachos-hex',
                name: 'nachos',
                adaAddress: 'addr123',
                og: 0,
                image: 'ipfs://123',
                slotNumber: 1234
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
                slotNumber: 1234
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
                hexName: 'nachos-hex',
                name: 'nachos',
                adaAddress: 'addr123',
                og: 0,
                image: 'ipfs://123',
                slotNumber: 1234
            });

            const existingHandle = HandleStore.get('nachos-hex');
            expect(existingHandle?.resolved_addresses.ada).toEqual('addr123');
            expect(existingHandle?.holder_address).toEqual(stakeKey);

            const newAddress = 'addr123_new';
            await HandleStore.saveWalletAddressMove({
                hexName: 'nachos-hex',
                adaAddress: newAddress,
                slotNumber: 1234
            });

            const handle = HandleStore.get('nachos-hex');
            expect(handle).toEqual({
                holder_address: updatedStakeKey,
                default_in_wallet: 'nachos',
                background: '',
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
                resolved_addresses: { ada: newAddress },
                created_slot_number: expect.any(Number),
                updated_slot_number: expect.any(Number)
            });
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

    describe('prepareHandlesStorage tests', () => {
        it('Should get starting point from AWS file because it is newer', async () => {
            const saveSpy = jest.spyOn(HandleStore, 'save');
            const saveFileSpy = jest.spyOn(HandleStore, 'saveFile');
            jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
                slot: 75171663,
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                handles: {
                    handle1: handlesFixture[0],
                    handle2: handlesFixture[1]
                },
                schemaVersion: 1
            });
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
                slot: 42971872,
                hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
                handles: {},
                schemaVersion: 1
            });

            const startingPoint = await HandleStore.prepareHandlesStorage();

            expect(startingPoint).toEqual({
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                slot: 75171663,
                handles: expect.any(Object),
                schemaVersion: 1
            });

            expect(saveSpy).toHaveBeenCalledTimes(2);
            expect(saveFileSpy).toHaveBeenCalledWith(
                75171663,
                'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368'
            );
        });

        it('Should get starting point from the local file because it is newer', async () => {
            const saveFileSpy = jest.spyOn(HandleStore, 'saveFile');
            jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
                slot: 42971872,
                hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
                handles: {},
                schemaVersion: HandleStore.storageSchemaVersion
            });
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
                slot: 75171663,
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                handles: {},
                schemaVersion: HandleStore.storageSchemaVersion
            });
            const startingPoint = await HandleStore.prepareHandlesStorage();
            expect(startingPoint).toEqual({
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                slot: 75171663,
                handles: expect.any(Object),
                schemaVersion: HandleStore.storageSchemaVersion
            });
            expect(saveFileSpy).toHaveBeenCalledTimes(0);
        });

        it('Should get starting point from the online file because the schema is newer', async () => {
            const saveFileSpy = jest.spyOn(HandleStore, 'saveFile');
            jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
                slot: 42971872,
                hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
                handles: {},
                schemaVersion: 2
            });
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
                slot: 75171663,
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                handles: {},
                schemaVersion: 1
            });
            const startingPoint = await HandleStore.prepareHandlesStorage();
            expect(startingPoint).toEqual({
                hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
                slot: 42971872,
                handles: expect.any(Object),
                schemaVersion: 2 // newer
            });
            expect(saveFileSpy).toHaveBeenCalledTimes(1);
        });

        it('Should get starting point from the local file when schema is unavailable', async () => {
            const saveFileSpy = jest.spyOn(HandleStore, 'saveFile');
            jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
                slot: 42971872,
                hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
                handles: {}
            });
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
                slot: 75171663,
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                handles: {},
                schemaVersion: HandleStore.storageSchemaVersion
            });
            const startingPoint = await HandleStore.prepareHandlesStorage();
            expect(startingPoint).toEqual({
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                slot: 75171663,
                handles: expect.any(Object),
                schemaVersion: HandleStore.storageSchemaVersion
            });
            expect(saveFileSpy).toHaveBeenCalledTimes(0);
        });

        it('Should get starting point from the local file when online file is unavailable', async () => {
            const saveFileSpy = jest.spyOn(HandleStore, 'saveFile');
            jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue(null);
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
                slot: 1,
                hash: 'a',
                handles: {},
                schemaVersion: HandleStore.storageSchemaVersion
            });
            const startingPoint = await HandleStore.prepareHandlesStorage();
            expect(startingPoint).toEqual({
                hash: 'a',
                slot: 1,
                handles: expect.any(Object),
                schemaVersion: HandleStore.storageSchemaVersion
            });
            expect(saveFileSpy).toHaveBeenCalledTimes(0);
        });

        it('Should get starting point from the online file when local available', async () => {
            const saveFileSpy = jest.spyOn(HandleStore, 'saveFile');
            jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
                slot: 2,
                hash: 'b',
                schemaVersion: 1,
                handles: {}
            });
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue(null);
            const startingPoint = await HandleStore.prepareHandlesStorage();
            expect(startingPoint).toEqual({
                hash: 'b',
                slot: 2,
                schemaVersion: 1,
                handles: expect.any(Object)
            });
            expect(saveFileSpy).toHaveBeenCalledTimes(1);
        });

        it('Should use starting point from constants if both AWS and local file are not found', async () => {
            // clear the mock so we don't see the beforeAll() saves
            jest.clearAllMocks();
            const saveSpy = jest.spyOn(HandleStore, 'save');
            const saveFileSpy = jest.spyOn(HandleStore, 'saveFile');
            jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue(null);
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue(null);
            const startingPoint = await HandleStore.prepareHandlesStorage();
            expect(startingPoint).toEqual(null);
            expect(saveSpy).toHaveBeenCalledTimes(0);
            expect(saveFileSpy).toHaveBeenCalledTimes(0);
        });

        it('Should use starting point from constants if local schemaVersion does not match the HandleStore.storageSchemaVersion', async () => {
            // clear the mock so we don't see the beforeAll() saves
            jest.clearAllMocks();
            const saveSpy = jest.spyOn(HandleStore, 'save');
            const saveFileSpy = jest.spyOn(HandleStore, 'saveFile');
            jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue(null);
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
                slot: 1,
                hash: 'a',
                handles: {},
                schemaVersion: 1
            });
            const startingPoint = await HandleStore.prepareHandlesStorage();
            expect(startingPoint).toEqual(null);
            expect(saveSpy).toHaveBeenCalledTimes(0);
            expect(saveFileSpy).toHaveBeenCalledTimes(0);
        });
    });
});
