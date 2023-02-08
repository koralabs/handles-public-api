import { HandlePaginationModel } from '../../models/handlePagination.model';
import { HandleSearchModel } from '../../models/HandleSearch.model';
import MemoryHandlesRepository from './handles.repository';
import { HandleStore } from './HandleStore';
import { handlesFixture } from './tests/fixtures/handles';
import * as addresses from '../../utils/addresses';
import * as stateQueryService from '../../services/ogmios/stateQuery/ogmios.stateQuery.service';
import { SaveMintingTxInput } from './interfaces/handleStore.interfaces';

jest.mock('../../utils/addresses');
jest.mock('../../services/ogmios/stateQuery/ogmios.stateQuery.service');

describe('MemoryHandlesRepository Tests', () => {
    beforeAll(async () => {
        jest.spyOn(addresses, 'getAddressHolderDetails').mockResolvedValue({
            address: 'stake-key1',
            type: 'ScriptHash',
            knownOwnerName: 'unknown'
        });

        const saves = handlesFixture.map(async (handle) => {
            const {
                hex: hexName,
                original_nft_image: image,
                name,
                og,
                utxo,
                updated_slot_number: slotNumber,
                resolved_addresses: { ada: adaAddress },
                hasDatum
            } = handle;
            return HandleStore.saveMintedHandle({ adaAddress, hexName, image, name, og, slotNumber, utxo, hasDatum });
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
            expect(result).toEqual([handlesFixture[0]]);
        });

        it('should find handles by rarity', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ rarity: 'common' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual([handlesFixture[2]]);
        });

        it('should no handles with compounded searches', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ rarity: 'rare', length: '7', holder_address: 'stake-key1' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual([]);
        });

        it('should find handle using search parameter', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ search: 'bur' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual([handlesFixture[1]]);
        });

        it('should find handles using holder_address parameter', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ holder_address: 'stake-key1' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual(handlesFixture);
        });

        it('should find no handles using invalid holder_address parameter', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ holder_address: 'nope' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual([]);
        });

        it('should paginate handles by slot number', async () => {
            const repo = new MemoryHandlesRepository();
            const { updated_slot_number } = handlesFixture[0];
            const pagination = new HandlePaginationModel({ slotNumber: `${updated_slot_number}`, handlesPerPage: '1' });
            const search = new HandleSearchModel({});
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual([handlesFixture[0]]);
        });

        it('should paginate handles by slot number and sort ascending by default', async () => {
            const repo = new MemoryHandlesRepository();
            const { updated_slot_number } = handlesFixture[0];
            const pagination = new HandlePaginationModel({ slotNumber: `${updated_slot_number}` });
            const search = new HandleSearchModel({});
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual([handlesFixture[0], handlesFixture[1], handlesFixture[2]]);
        });

        it('should paginate handles by slot number and sort desc', async () => {
            const repo = new MemoryHandlesRepository();
            const { updated_slot_number } = handlesFixture[1];
            const pagination = new HandlePaginationModel({ slotNumber: `${updated_slot_number}`, sort: 'desc' });
            const search = new HandleSearchModel({});
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual([handlesFixture[1], handlesFixture[0]]);
        });
    });

    describe('getAllHandleNames', () => {
        it('should get all handle names', async () => {
            jest.spyOn(HandleStore, 'getHandles').mockReturnValue(handlesFixture);
            const repo = new MemoryHandlesRepository();
            const search = new HandleSearchModel({});
            const result = await repo.getAllHandleNames(search, 'asc');
            expect(result).toEqual(['barbacoa', 'burritos', 'taco']);
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
                type: 'ScriptHash'
            });
        });
    });

    describe('getHandleStats', () => {
        it('should get metrics', () => {
            const repo = new MemoryHandlesRepository();
            const result = repo.getHandleStats();
            expect(result).toEqual({
                buildingElapsed: '0:00',
                currentBlockHash: '',
                currentMemoryUsed: expect.any(Number),
                currentSlot: 0,
                handleCount: 3,
                memorySize: 0,
                ogmiosElapsed: '0:00',
                percentageComplete: '0.00',
                slotDate: expect.any(Date)
            });
        });
    });

    describe('getHandleDatumByName', () => {
        beforeAll(async () => {
            const saveHandleInput: SaveMintingTxInput = {
                hexName: 'salsa-hex',
                name: 'salsa',
                adaAddress: 'addr1salsa',
                og: 0,
                image: '',
                slotNumber: 0,
                utxo: 'test_tx#0',
                hasDatum: true
            };
            await HandleStore.saveMintedHandle(saveHandleInput);
        });

        it('should not get datum if hasDatum is false', async () => {
            const datum = 'a2some2key6another2key';
            const getDatumFileSpy = jest.spyOn(HandleStore, 'getDatumFromFileSystem').mockResolvedValue(datum);
            const repo = new MemoryHandlesRepository();
            const result = await repo.getHandleDatumByName('barbacoa');

            expect(result).toEqual(null);
            expect(getDatumFileSpy).toHaveBeenCalledTimes(0);
        });

        it('should get handle datum by name', async () => {
            const datum = 'a2some2key6another2key';
            jest.spyOn(HandleStore, 'getDatumFromFileSystem').mockResolvedValue(datum);
            const repo = new MemoryHandlesRepository();
            const result = await repo.getHandleDatumByName('salsa');
            expect(result).toEqual(datum);
        });

        it('should not find datum in the local file system and instead find it using ogmios', async () => {
            const datum = 'a2some2key6another2key';
            jest.spyOn(HandleStore, 'getDatumFromFileSystem').mockResolvedValue(null);
            jest.spyOn(HandleStore, 'saveDatumFile').mockImplementation();
            jest.spyOn(stateQueryService, 'queryStateByUtxo').mockResolvedValue([
                [
                    { txId: 'txId', index: 0 },
                    { address: 'addr', value: { coins: BigInt(1) }, datum }
                ]
            ]);
            const repo = new MemoryHandlesRepository();
            const result = await repo.getHandleDatumByName('salsa');
            expect(result).toEqual(datum);
        });

        it('should return null when no data is found and save null to the file system', async () => {
            jest.spyOn(HandleStore, 'getDatumFromFileSystem').mockResolvedValue(null);
            jest.spyOn(stateQueryService, 'queryStateByUtxo').mockResolvedValue([
                [
                    { txId: 'txId', index: 0 },
                    { address: 'addr', value: { coins: BigInt(1) } }
                ]
            ]);
            const saveSpy = jest.spyOn(HandleStore, 'saveDatumFile').mockImplementation();
            const repo = new MemoryHandlesRepository();
            const result = await repo.getHandleDatumByName('salsa');

            expect(saveSpy).toHaveBeenCalledWith({ datum: null, handleHex: 'salsa-hex', utxo: 'test_tx#0' });
            expect(result).toEqual(null);
        });
    });
});
