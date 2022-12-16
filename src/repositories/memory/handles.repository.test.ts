import { HandlePaginationModel } from '../../models/handlePagination.model';
import { HandleSearchModel } from '../../models/HandleSearch.model';
import MemoryHandlesRepository from './handles.repository';
import { HandleStore } from './HandleStore';
import { handlesFixture } from './fixtures/handles';

describe('MemoryHandlesRepository Tests', () => {
    beforeAll(async () => {
        const saves = handlesFixture.map(async (handle) => HandleStore.save(handle));
        await Promise.all(saves);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAll', () => {
        it('should get all handles', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel('1', 'asc');
            const search = new HandleSearchModel({});
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ cursor: 'burrito-hex', handles: [handlesFixture[0]], total: 3 });
        });

        it('should find rare handles', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel('100', 'asc');
            const search = new HandleSearchModel({ rarity: 'rare' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ handles: [handlesFixture[2]], total: 1 });
        });

        it('should no handles with compounded searches', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel('100', 'asc');
            const search = new HandleSearchModel({ rarity: 'rare', length: '7' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ handles: [], total: 0 });
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
    });

    describe('getHandleByName', () => {
        it('should get handle by name', async () => {
            const repo = new MemoryHandlesRepository();
            const result = await repo.getHandleByName('barbacoa');
            expect(result).toEqual(handlesFixture[0]);
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
});
