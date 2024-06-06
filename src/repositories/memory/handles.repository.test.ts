import { HandlePaginationModel } from '../../models/handlePagination.model';
import { HandleSearchModel } from '../../models/HandleSearch.model';
import MemoryHandlesRepository from './handles.repository';
import { HandleStore } from './HandleStore';
import { handlesFixture, holdersFixture } from './tests/fixtures/handles';
import * as addresses from '../../utils/addresses';
import { HolderAddressIndex, SaveMintingTxInput } from './interfaces/handleStore.interfaces';
import * as config from '../../config';
import { HolderPaginationModel } from '../../models/holderPagination.model';
import { AssetNameLabel, HandleType, ISubHandleSettingsDatumStruct } from '@koralabs/kora-labs-common';

describe('MemoryHandlesRepository Tests', () => {
    const expectedVirtualHandle = {
        amount: 1,
        bg_image: '',
        characters: 'letters',
        created_slot_number: 8,
        default_in_wallet: 'taco',
        has_datum: false,
        hex: '0000000076407461636f',
        holder: 'stake-key1',
        holder_type: '',
        image: '',
        image_hash: '',
        length: 6,
        name: 'v@taco',
        numeric_modifiers: '',
        og_number: 0,
        personalization: {
            nsfw: false,
            trial: false,
            validated_by: ''
        },
        pfp_image: '',
        rarity: 'common',
        reference_token: {
            address: '',
            datum: '',
            index: 0,
            lovelace: 0,
            tx_id: ''
        },
        resolved_addresses: {
            ada: 'addr_test1kqn99rzddnrh63f8lz4hj3j36z4raukuqmj0t47nds6x2xkt9e3'
        },
        standard_image: '',
        standard_image_hash: '',
        svg_version: '',
        handle_type: 'virtual_subhandle',
        updated_slot_number: 8,
        utxo: '#0',
        version: 0
    };

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
                handle_type
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
                handle_type
            });
        });

        saves.push(
            HandleStore.savePersonalizationChange({
                name: 'v@taco',
                hex: `${AssetNameLabel.LBL_000}76407461636f`,
                personalization: {
                    validated_by: '',
                    trial: false,
                    nsfw: false
                },
                reference_token: {
                    tx_id: '',
                    index: 0,
                    lovelace: 0,
                    datum: '',
                    address: ''
                },
                personalizationDatum: {
                    standard_image: '',
                    image_hash: '',
                    standard_image_hash: '',
                    default: 0,
                    validated_by: '',
                    trial: 0,
                    nsfw: 0,
                    last_update_address: '',
                    svg_version: '',
                    agreed_terms: '',
                    migrate_sig_required: 0,
                    resolved_addresses: {
                        ada: '0xb026528c4d6cc77d4527f8ab794651d0aa3ef2dc06e4f5d7d36c3465'
                    }
                },
                slotNumber: 8,
                metadata: null
            })
        );
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
            expect(result).toEqual({ searchTotal: 1, handles: [handlesFixture[0]] });
        });

        it('should find handles by rarity', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ rarity: 'common' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 3, handles: [handlesFixture[1], handlesFixture[2], expectedVirtualHandle] });
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
            expect(result).toEqual({ searchTotal: handlesFixture.length + 1, handles: [...handlesFixture, expectedVirtualHandle] });
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
            expect(result).toEqual({ searchTotal: 1, handles: [handlesFixture[0]] });
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
            expect(result).toEqual({ searchTotal: 3, handles: [handlesFixture[1], handlesFixture[0], expectedVirtualHandle] });
        });

        it('should find handles using handle_type parameter', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ handle_type: HandleType.VIRTUAL_SUBHANDLE });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ searchTotal: 1, handles: [expectedVirtualHandle] });
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
            expect(result).toEqual(['burrito', 'taco', 'v@taco']);
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
                handle_type: HandleType.HANDLE
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
                total_handles: 4,
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
                handle_count: 4,
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
                handle_type: HandleType.HANDLE
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

    describe('getSubHandleSettings', () => {
        const rootHandleName = 'chili-colorado';

        beforeAll(async () => {
            const rootHandleInput: SaveMintingTxInput = {
                hex: 'chili-colorado-hex',
                name: rootHandleName,
                adaAddress: 'addr1chili-colorado',
                og_number: 0,
                image: '',
                slotNumber: 0,
                utxo: 'test_tx#0',
                datum: 'a2some2key6another2key',
                image_hash: '',
                svg_version: '',
                handle_type: HandleType.HANDLE
            };
            await Promise.all([HandleStore.saveMintedHandle(rootHandleInput)]);
        });

        it('should not get subhandle settings if handle does not exist', async () => {
            const repo = new MemoryHandlesRepository();
            try {
                await repo.getSubHandleSettings('nope@handle');
                throw new Error('expected error');
            } catch (error: any) {
                expect(error.message).toEqual('Not found');
            }
        });

        it('should get subhandle settings by name', async () => {
            const repo = new MemoryHandlesRepository();

            const reference_token = { address: 'addr123', datum: 'a2436e6674a347656e61626c6564014b7469657250726963696e679f9f011903e8ff9f021901f4ff9f0318faff9f040affff48656e61626c65507a00477669727475616ca447656e61626c6564014b7469657250726963696e679f9f010fffff48656e61626c65507a004f657870697265735f696e5f64617973190168', index: 0, lovelace: 1, tx_id: 'some_id' };
            const settings = 'abc';
            await HandleStore.saveSubHandleSettingsChange({
                name: rootHandleName,
                reference_token,
                settingsDatum: settings,
                slotNumber: 0
            });

            const result = await repo.getSubHandleSettings(rootHandleName);
            expect(result).toEqual({
                reference_token,
                settings
            });
        });
    });

    describe('getSubHandles', () => {
        const rootHandleName = 'chili-verde';
        const subHandle = `taco@${rootHandleName}`;

        beforeAll(async () => {
            const subHandleInput: SaveMintingTxInput = {
                hex: `${subHandle}-hex`,
                name: subHandle,
                adaAddress: `addr1${rootHandleName}`,
                og_number: 0,
                image: '',
                slotNumber: 0,
                utxo: 'test_tx#0',
                datum: 'a2some2key6another2key',
                image_hash: '',
                svg_version: '',
                handle_type: HandleType.NFT_SUBHANDLE
            };
            await Promise.all([HandleStore.saveMintedHandle(subHandleInput)]);
        });

        it('should get subhandles for root handle', async () => {
            const repo = new MemoryHandlesRepository();
            const result = await repo.getSubHandles(rootHandleName);
            expect(result.length).toEqual(1);
            expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ name: subHandle })]));
        });
    });
});
