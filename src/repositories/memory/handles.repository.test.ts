import { HandlePaginationModel } from '../../models/handlePagination.model';
import { HandleSearchModel } from '../../models/HandleSearch.model';
import MemoryHandlesRepository from './handles.repository';
import { HandleStore } from './HandleStore';
import { handlesFixture, holdersFixture, createRandomHandles, performRandomHandleUpdates } from './tests/fixtures/handles';
import * as addresses from '../../utils/addresses';
import { HolderAddressIndex, SaveMintingTxInput } from './interfaces/handleStore.interfaces';
import * as config from '../../config';
import { HolderPaginationModel } from '../../models/holderPagination.model';
import { HandleType } from '@koralabs/kora-labs-common';

describe('MemoryHandlesRepository Tests', () => {
    jest.mock('../../utils/addresses');
    beforeAll(async () => {
        jest.spyOn(addresses, 'getAddressHolderDetails').mockReturnValue({
            address: 'stake-key1',
            type: '',
            knownOwnerName: 'unknown'
        });

        const saves = handlesFixture.map(async (handle) => {
            const {
                hex,
                standard_image: image,
                name,
                og_number,
                utxo,
                updated_slot_number: slotNumber,
                resolved_addresses: { ada: adaAddress },
                datum,
                image_hash,
                svg_version,
                type
            } = handle;
            return HandleStore.saveMintedHandle({
                adaAddress,
                hex,
                image,
                name,
                og_number,
                slotNumber,
                utxo,
                datum,
                image_hash,
                svg_version,
                type
            });
        });
        await Promise.all(saves);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAll', () => {
        it('should get all handles', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel({ page: '1', handlesPerPage: '1', sort: 'asc' });
            const search = new HandleSearchModel({});
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 3, handles: [handlesFixture[0]] });
        });

        it('should find handles by rarity', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ rarity: 'common' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 2, handles: [handlesFixture[1], handlesFixture[2]] });
        });

        it('should no handles with compounded searches', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ rarity: 'rare', length: '7', holder_address: 'stake-key1' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 0, handles: [] });
        });

        it('should find handle using search parameter', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ search: 'bur' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 1, handles: [handlesFixture[1]] });
        });

        it('should find handles using holder_address parameter', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ holder_address: 'stake-key1' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: handlesFixture.length, handles: handlesFixture });
        });

        it('should find no handles using invalid holder_address parameter', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ holder_address: 'nope' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 0, handles: [] });
        });

        it('should paginate handles by slot number', async () => {
            const repo = new MemoryHandlesRepository();
            const { updated_slot_number } = handlesFixture[0];
            const pagination = new HandlePaginationModel({ slotNumber: `${updated_slot_number}`, handlesPerPage: '1' });
            const search = new HandleSearchModel({});
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 3, handles: [handlesFixture[0]] });
        });

        it('should paginate handles by slot number and sort ascending by default', async () => {
            const repo = new MemoryHandlesRepository();
            const { updated_slot_number } = handlesFixture[0];
            const pagination = new HandlePaginationModel({ slotNumber: `${updated_slot_number}` });
            const search = new HandleSearchModel({});
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 3, handles: [handlesFixture[0], handlesFixture[1], handlesFixture[2]] });
        });

        it('should paginate handles by slot number and sort desc', async () => {
            const repo = new MemoryHandlesRepository();
            const { updated_slot_number } = handlesFixture[1];
            const pagination = new HandlePaginationModel({ slotNumber: `${updated_slot_number}`, sort: 'desc' });
            const search = new HandleSearchModel({});
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 3, handles: [handlesFixture[1], handlesFixture[0]] });
        });

        it('should find handles by name using the handle parameter', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ handles: ['barbacoa', 'taco'] });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 2, handles: [handlesFixture[0], handlesFixture[2]] });
        });

        it('should find handles by hex using the handle parameter', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ handles: ['barbacoa-hex'] });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 1, handles: [handlesFixture[0]] });
        });
    });

    describe('getAllHandleNames', () => {
        it('should get all handle names', async () => {
            jest.spyOn(HandleStore, 'getHandles').mockReturnValue(handlesFixture);
            const repo = new MemoryHandlesRepository();
            const search = new HandleSearchModel({});
            const result = await repo.getAllHandleNames(search, 'asc');
            expect(result).toEqual(['barbacoa', 'burrito', 'taco']);
        });

        it('should search all handle names', async () => {
            jest.spyOn(HandleStore, 'getHandles').mockReturnValue(handlesFixture);
            const repo = new MemoryHandlesRepository();
            const search = new HandleSearchModel({
                length: '4'
            });
            const result = await repo.getAllHandleNames(search, 'asc');
            expect(result).toEqual(['taco']);
        });

        it('should search all handle names', async () => {
            jest.spyOn(HandleStore, 'getHandles').mockReturnValue(handlesFixture);
            const repo = new MemoryHandlesRepository();
            const search = new HandleSearchModel({
                length: '4-7'
            });
            const result = await repo.getAllHandleNames(search, 'asc');
            expect(result).toEqual(['burrito', 'taco']);
        });

        it('should sort handles randomly', async () => {
            jest.spyOn(HandleStore, 'getHandles').mockReturnValue(handlesFixture);
            const repo = new MemoryHandlesRepository();
            const search = new HandleSearchModel();
            const result1 = await repo.getAllHandleNames(search, 'random');
            const result2 = await repo.getAllHandleNames(search, 'random');
            const result3 = await repo.getAllHandleNames(search, 'random');
            const result4 = await repo.getAllHandleNames(search, 'random');
            const noWayTheyreEqual = [result2, result3, result4].every((r) => r == result1);
            expect(noWayTheyreEqual).toEqual(false);
        });

        it('should remove handles without a UTxO', async () => {
            const newHandle = HandleStore.buildHandle({
                hex: 'new-handle-hex',
                name: 'new-handle',
                adaAddress: '',
                utxo: '',
                og_number: 0,
                image: '',
                slotNumber: 0,
                datum: '',
                image_hash: '',
                svg_version: '',
                type: HandleType.HANDLE
            });
            const handles = [...handlesFixture, newHandle];
            jest.spyOn(HandleStore, 'getHandles').mockReturnValue(handles);
            const repo = new MemoryHandlesRepository();
            const search = new HandleSearchModel();
            const result = await repo.getAllHandleNames(search, 'asc');
            expect(result).toEqual(['barbacoa', 'burrito', 'taco']);
        });
    });

    describe('getHandleByName', () => {
        it('should get handle by name', async () => {
            const repo = new MemoryHandlesRepository();
            const result = await repo.getHandleByName('barbacoa');
            expect(result).toEqual(handlesFixture[0]);
        });
    });

    describe('getHolderAddressDetails', () => {
        it('should get holderAddress details', async () => {
            const repo = new MemoryHandlesRepository();
            const result = await repo.getHolderAddressDetails('stake-key1');
            expect(result).toEqual({
                address: 'stake-key1',
                default_handle: 'taco',
                known_owner_name: 'unknown',
                manually_set: false,
                total_handles: 3,
                type: ''
            });
        });
    });
    describe('getAllHolders', () => {
        it('should get holderAddress list', async () => {
            jest.mock('./HandleStore', () => ({
                __esModule: true,
                holderAddressIndex: holdersFixture
            }));
            const mockHandleStore = HandleStore as { holderAddressIndex: Map<string, HolderAddressIndex> };
            mockHandleStore.holderAddressIndex = holdersFixture;
            const repo = new MemoryHandlesRepository();
            const result = await repo.getAllHolders({ pagination: new HolderPaginationModel() });
            expect(result).toEqual([
                {
                    total_handles: 2,
                    default_handle: 'tacos',
                    manually_set: false,
                    address: 'addr2',
                    known_owner_name: '',
                    type: 'wallet'
                },
                {
                    total_handles: 1,
                    default_handle: 'burritos',
                    manually_set: false,
                    address: 'addr1',
                    known_owner_name: 'funnable.token',
                    type: 'script'
                }
            ]);
        });
    });

    describe('getHandleStats', () => {
        it('should get metrics', () => {
            const repo = new MemoryHandlesRepository();
            const result = repo.getHandleStats();
            expect(result).toEqual({
                building_elapsed: '0:00',
                current_block_hash: '',
                current_memory_used: expect.any(Number),
                current_slot: 0,
                handle_count: 3,
                memory_size: 0,
                ogmios_elapsed: '0:00',
                percentage_complete: '0.00',
                slot_date: expect.any(Date),
                schema_version: HandleStore.storageSchemaVersion
            });
        });
    });

    describe('getHandleDatumByName', () => {
        const datum = 'a2some2key6another2key';
        beforeAll(async () => {
            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);
            const saveHandleInput: SaveMintingTxInput = {
                hex: 'salsa-hex',
                name: 'salsa',
                adaAddress: 'addr1salsa',
                og_number: 0,
                image: '',
                slotNumber: 0,
                utxo: 'test_tx#0',
                datum,
                image_hash: '',
                svg_version: '',
                type: HandleType.HANDLE
            };
            await Promise.all([
                HandleStore.saveMintedHandle(saveHandleInput),
                HandleStore.saveMintedHandle({
                    ...saveHandleInput,
                    hex: 'pollo-verde-hex',
                    name: 'pollo-verde',
                    utxo: ''
                })
            ]);
        });

        it('should not get datum if has_datum is false', async () => {
            const repo = new MemoryHandlesRepository();
            const result = await repo.getHandleDatumByName('barbacoa');

            expect(result).toEqual(null);
        });

        it('should get handle datum by name', async () => {
            const repo = new MemoryHandlesRepository();
            const result = await repo.getHandleDatumByName('salsa');
            expect(result).toEqual(datum);
        });

        it('should not find handle when utxo is empty (100 before 222 token)', async () => {
            const repo = new MemoryHandlesRepository();
            try {
                await repo.getHandleDatumByName('pollo-verde');
                throw new Error('expected error');
            } catch (error: any) {
                expect(error.message).toEqual('Not found');
            }
        });
    });
});
