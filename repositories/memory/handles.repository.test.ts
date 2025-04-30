import { HandlePaginationModel, HandleSearchModel, HandleType, Holder, HolderPaginationModel, Rarity, StoredHandle } from '@koralabs/kora-labs-common';
import { MemoryHandlesProvider } from '.';
import * as config from '../../config';
import { HandlesRepository } from '../handlesRepository';
import { HandleStore } from './handleStore';
import { handlesFixture, holdersFixture } from './tests/fixtures/handles';
const repo = new HandlesRepository(new MemoryHandlesProvider());
const policy = 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a';

describe('MemoryHandlesProvider Tests', () => {
    const expectedVirtualHandle = {
        amount: 1,
        bg_image: '',
        characters: 'letters',
        created_slot_number: 0,
        default_in_wallet: 'taco',
        has_datum: false,
        hex: Buffer.from('0000000076407461636f').toString('utf-8'),
        holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
        holder_type: 'wallet',
        image: '',
        image_hash: '',
        length: 6,
        name: 'v@taco',
        numeric_modifiers: '',
        og_number: 0,
        payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
        personalization: {
            nsfw: false,
            trial: false,
            validated_by: ''
        },
        pfp_image: '',
        rarity: Rarity.common,
        reference_token: {
            address: '',
            datum: '',
            index: 0,
            lovelace: 0,
            tx_id: ''
        },
        resolved_addresses: {
            ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
        },
        standard_image: '',
        standard_image_hash: '',
        svg_version: '',
        handle_type: HandleType.VIRTUAL_SUBHANDLE,
        updated_slot_number: 8,
        last_update_address: '',
        utxo: '#0',
        lovelace: 0,
        version: 0,
        pz_enabled: false,
        policy
    };

    beforeAll(async () => {
        const saves = handlesFixture.map(async (handle) => {
            return repo.save(handle);
        });

        saves.push(
            repo.save(await repo.Internal.buildHandle(expectedVirtualHandle))
        );
        await Promise.all(saves);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAll', () => {
        it('should get all handles', async () => {
            const pagination = new HandlePaginationModel({ page: '1', handlesPerPage: '1', sort: 'asc' });
            const search = new HandleSearchModel({});
            const result = repo.search(pagination, search);
            expect(result).toEqual({ searchTotal: 4, handles: [handlesFixture[0]] });
        });

        it('should find handles by rarity', async () => {
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ rarity: 'common' });
            const result = repo.search(pagination, search);
            expect(result).toEqual({ searchTotal: 3, handles: [handlesFixture[1], handlesFixture[2], expectedVirtualHandle] });
        });

        it('should no handles with compounded searches', async () => {
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ rarity: 'rare', length: '7', holder_address: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70' });
            const result = repo.search(pagination, search);
            expect(result).toEqual({ searchTotal: 0, handles: [] });
        });

        it('should find handle using search parameter', async () => {
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ search: 'bur' });
            const result = repo.search(pagination, search);
            expect(result).toEqual({ searchTotal: 1, handles: [handlesFixture[1]] });
        });

        it('should find handles using holder_address parameter', async () => {
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ holder_address: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70' });
            const result = repo.search(pagination, search);
            expect(result).toEqual({ searchTotal: handlesFixture.length + 1, handles: [...handlesFixture, expectedVirtualHandle] });
        });

        it('should find no handles using invalid holder_address parameter', async () => {
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ holder_address: 'nope' });
            const result = repo.search(pagination, search);
            expect(result).toEqual({ searchTotal: 0, handles: [] });
        });

        it('should paginate handles by slot number', async () => {
            const { updated_slot_number } = handlesFixture[0];
            const pagination = new HandlePaginationModel({ slotNumber: `${updated_slot_number}`, handlesPerPage: '1' });
            const search = new HandleSearchModel({});
            const result = repo.search(pagination, search);
            expect(result).toEqual({ searchTotal: 4, handles: [handlesFixture[0]] });
        });

        it('should paginate handles by slot number and sort ascending by default', async () => {
            const { updated_slot_number } = handlesFixture[0];
            const pagination = new HandlePaginationModel({ slotNumber: `${updated_slot_number}` });
            const search = new HandleSearchModel({});
            const result = repo.search(pagination, search);
            expect(result).toEqual({ searchTotal: 4, handles: [handlesFixture[0], handlesFixture[1], handlesFixture[2]] });
        });

        it('should paginate handles by slot number and sort desc', async () => {
            const { updated_slot_number } = handlesFixture[1];
            const pagination = new HandlePaginationModel({ slotNumber: `${updated_slot_number}`, sort: 'desc' });
            const search = new HandleSearchModel({});
            const result = repo.search(pagination, search);
            expect(result).toEqual({ searchTotal: 4, handles: [handlesFixture[1], handlesFixture[0], expectedVirtualHandle] });
        });

        it('should find handles using handle_type parameter', async () => {
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ handle_type: HandleType.VIRTUAL_SUBHANDLE });
            const result = repo.search(pagination, search);
            expect(result).toEqual({ searchTotal: 1, handles: [expectedVirtualHandle] });
        });

        it('should find handles by name using the handle parameter', async () => {
            const pagination = new HandlePaginationModel();
            const search = new HandleSearchModel({ handles: ['barbacoa', 'taco'] });
            const result = repo.search(pagination, search);
            expect(result).toEqual({ searchTotal: 2, handles: [handlesFixture[0], handlesFixture[2]] });
        });
    });

    describe('getAllHandleNames', () => {
        it('should get all handle names', async () => {
            jest.spyOn(MemoryHandlesProvider.prototype, 'getAllHandles').mockReturnValue(handlesFixture);
            const search = new HandleSearchModel({});
            const result = repo.getAllHandleNames(search, 'asc');
            expect(result).toEqual(['barbacoa', 'burrito', 'taco']);
        });

        it('should search all handle names', async () => {
            jest.spyOn(MemoryHandlesProvider.prototype, 'getAllHandles').mockReturnValue(handlesFixture);
            const search = new HandleSearchModel({
                length: '4'
            });
            const result = repo.getAllHandleNames(search, 'asc');
            expect(result).toEqual(['taco']);
        });

        it('should search all handle names', async () => {
            jest.spyOn(MemoryHandlesProvider.prototype, 'getAllHandles').mockReturnValue(handlesFixture);
            const search = new HandleSearchModel({
                length: '4-7'
            });
            const result = repo.getAllHandleNames(search, 'asc');
            expect(result).toEqual(['burrito', 'taco', 'v@taco']);
        });

        it('should sort handles randomly', async () => {
            jest.spyOn(MemoryHandlesProvider.prototype, 'getAllHandles').mockReturnValue(handlesFixture);
            const search = new HandleSearchModel();
            const result1 = repo.getAllHandleNames(search, 'random');
            const result2 = repo.getAllHandleNames(search, 'random');
            const result3 = repo.getAllHandleNames(search, 'random');
            const result4 = repo.getAllHandleNames(search, 'random');
            const noWayTheyreEqual = [result2, result3, result4].every((r) => r == result1);
            expect(noWayTheyreEqual).toEqual(false);
        });

        it('should remove handles without a UTxO', async () => {
            const newHandle = await repo.Internal.buildHandle({
                policy: 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a',
                hex: Buffer.from('new-handle').toString('hex'),
                name: 'new-handle',
                utxo: '',
                lovelace: 0,
                og_number: 0,
                image: '',
                updated_slot_number: 0,
                datum: '',
                image_hash: '',
                svg_version: '',
                handle_type: HandleType.HANDLE,
                resolved_addresses: {ada: ''}
            });
            const handles = [...handlesFixture, newHandle];
            jest.spyOn(MemoryHandlesProvider.prototype, 'getAllHandles').mockReturnValue(handles as StoredHandle[]);
            const search = new HandleSearchModel();
            const result = repo.getAllHandleNames(search, 'asc');
            expect(result).toEqual(['barbacoa', 'burrito', 'taco']);
        });
    });

    describe('getHandleByName', () => {
        it('should get handle by name', async () => {
            const result = repo.getHandleByName('barbacoa');
            expect(result).toEqual(handlesFixture[0]);
        });
    });

    describe('getHolder', () => {
        it('should get holderAddress details', async () => {
            const result = repo.getHolder('stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70');
            expect(result).toEqual({
                defaultHandle: 'taco',
                knownOwnerName: '',
                manuallySet: false,
                handles: new Set([
                    'barbacoa',
                    'burrito',
                    'taco',
                    'v@taco'
                ]),
                type: 'wallet'
            });
        });
    });
    describe('getAllHolders', () => {
        it('should get holderAddress list', async () => {
            jest.mock('./handleStore', () => ({
                __esModule: true,
                holderIndex: holdersFixture
            }));
            const mockHandleStore = HandleStore as { holderIndex: Map<string, Holder> };
            mockHandleStore.holderIndex = holdersFixture;
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

    describe('getHandlesByStakeKeyHashes', () => {
        it('should get handles by stakeKeyHashes', async () => {
            const repo = new MemoryHandlesRepository();
            const result = repo.getHandlesByStakeKeyHashes(['e0f1a8e379127b811583070faf74db00d880d45027fe6171b1b69bd9ca']);
            expect(result).toEqual(['barbacoa', 'burrito', 'taco', 'v@taco']);
        });
    });

    describe('getHandleStats', () => {
        it('should get metrics', () => {
            const result = repo.getMetrics();
            expect(result).toEqual({
                elapsedBuildingExec: 0,
                currentBlockHash: '',
                firstMemoryUsage: expect.any(Number),
                currentSlot: 0,
                firstSlot: 0,
                lastSlot: 0,
                count: 4,
                memorySize: 0,
                elapsedOgmiosExec: 0
            });
        });
    });

    describe('getHandleDatumByName', () => {
        const datum = 'a2some2key6another2key';
        beforeAll(async () => {
            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);
            const handle = await repo.Internal.buildHandle({
                hex: Buffer.from('salsa').toString('hex'),
                name: 'salsa',
                og_number: 0,
                image: '',
                utxo: 'test_tx#0',
                lovelace: 0,
                datum,
                image_hash: '',
                svg_version: '',
                handle_type: HandleType.HANDLE,
                policy,
                resolved_addresses: {ada:'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'},
                updated_slot_number: 0
            });
            await Promise.all([
                repo.save(handle),
                repo.save({
                    ...handle,
                    hex: Buffer.from('pollo-verde').toString('hex'),
                    name: 'pollo-verde',
                    utxo: ''
                })
            ]);
        });

        it('should not get datum if has_datum is false', () => {
            const result = repo.getHandleDatumByName('barbacoa');

            expect(result).toEqual(null);
        });

        it('should get handle datum by name', () => {
            const result = repo.getHandleDatumByName('salsa');
            expect(result).toEqual(datum);
        });

        it('should not find handle when utxo is empty (100 before 222 token)', () => {
            try {
                repo.getHandleDatumByName('pollo-verde');
                throw new Error('expected error');
            } catch (error: any) {
                expect(error.message).toEqual('Not found');
            }
        });
    });

    describe('getSubHandleSettings', () => {
        const rootHandleName = 'chili-colorado';

        beforeAll(async () => {
            const handle = await repo.Internal.buildHandle({
                hex: Buffer.from(rootHandleName).toString('hex'),
                name: rootHandleName,
                og_number: 0,
                image: '',
                utxo: 'test_tx#0',
                lovelace: 0,
                datum: 'a2some2key6another2key',
                image_hash: '',
                svg_version: '',
                handle_type: HandleType.HANDLE,
                policy,
                resolved_addresses: {ada:'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'},
                updated_slot_number: 0
            });
            await Promise.all([repo.save(handle)]);
        });

        it('should not get subhandle settings if handle does not exist', () => {
            try {
                repo.getSubHandleSettings('nope@handle');
                throw new Error('expected error');
            } catch (error: any) {
                expect(error.message).toEqual('Not found');
            }
        });

        it('should get subhandle settings by name', async () => {
            const utxoDetails = { address: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q', datum: 'a2436e6674a347656e61626c6564014b7469657250726963696e679f9f011903e8ff9f021901f4ff9f0318faff9f040affff48656e61626c65507a00477669727475616ca447656e61626c6564014b7469657250726963696e679f9f010fffff48656e61626c65507a004f657870697265735f696e5f64617973190168', index: 0, lovelace: 1, tx_id: 'some_id' };
            const settings = 'abc';
            let handle = repo.get(rootHandleName)!;
            handle = await repo.Internal.buildHandle({
                ...handle,
                subhandle_settings: {
                    utxo: utxoDetails,
                    settings
                },
                updated_slot_number: 0,
                resolved_addresses: {ada: ''}
            })
            await repo.save(handle);

            const result = repo.getSubHandleSettings(rootHandleName);
            expect(result).toEqual({
                utxo: utxoDetails,
                settings
            });
        });
    });

    describe('getSubHandles', () => {
        const rootHandleName = 'chili-verde';
        const subHandle = `taco@${rootHandleName}`;

        beforeAll(async () => {
            const handle = await repo.Internal.buildHandle({
                hex: Buffer.from(subHandle).toString('hex'),
                name: subHandle,
                og_number: 0,
                image: '',
                utxo: 'test_tx#0',
                lovelace: 0,
                datum: 'a2some2key6another2key',
                image_hash: '',
                svg_version: '',
                handle_type: HandleType.NFT_SUBHANDLE,
                policy,
                resolved_addresses: {ada:'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'},
                updated_slot_number: 0
            });
            await Promise.all([repo.save(handle)]);
        });

        it('should get subhandles for root handle', async () => {
            const result = repo.getSubHandlesByRootHandle(rootHandleName);
            expect(result.length).toEqual(1);
            expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ name: subHandle })]));
        });
    });
});
