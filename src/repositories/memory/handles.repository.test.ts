import { IHandle, Rarity } from '../../interfaces/handle.interface';
import { HandlePaginationModel } from '../../models/handlePagination.model';
import { HandleSearchModel } from '../../models/HandleSearch.model';
import MemoryHandlesRepository from './handles.repository';
import { HandleStore } from './HandleStore';

describe('MemoryHandlesRepository Tests', () => {
    const handles: IHandle[] = [
        {
            hex: 'barbacoa-hex',
            name: 'barbacoa',
            nft_image: '',
            original_nft_image: '',
            length: 8,
            og: 0,
            rarity: Rarity.common,
            characters: 'letters',
            numeric_modifiers: '',
            resolved_addresses: {
                ada: ''
            },
            personalization: {}
        },
        {
            hex: 'burrito-hex',
            name: 'burrito',
            nft_image: '',
            original_nft_image: '',
            length: 7,
            og: 0,
            rarity: Rarity.basic,
            characters: 'letters',
            numeric_modifiers: '',
            resolved_addresses: {
                ada: ''
            },
            personalization: {}
        },
        {
            hex: 'taco-hex',
            name: 'taco',
            nft_image: '',
            original_nft_image: '',
            length: 4,
            og: 0,
            rarity: Rarity.rare,
            characters: 'letters',
            numeric_modifiers: '',
            resolved_addresses: {
                ada: ''
            },
            personalization: {}
        }
    ];

    handles.forEach((handle) => {
        HandleStore.save(handle);
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
            expect(result).toEqual({ cursor: 'burrito-hex', handles: [handles[0]], total: 3 });
        });

        it('should find rare handles', async () => {
            const repo = new MemoryHandlesRepository();
            const pagination = new HandlePaginationModel('100', 'asc');
            const search = new HandleSearchModel({ rarity: 'rare' });
            const result = await repo.getAll({ pagination, search });
            expect(result).toEqual({ handles: [handles[2]], total: 1 });
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
            jest.spyOn(HandleStore, 'getHandles').mockReturnValue(handles);
            const repo = new MemoryHandlesRepository();
            const result = await repo.getAllHandleNames();
            expect(result).toEqual(['barbacoa', 'burrito', 'taco']);
        });
    });

    describe('getHandleByName', () => {
        it('should get handle by name', async () => {
            const repo = new MemoryHandlesRepository();
            const result = await repo.getHandleByName('barbacoa');
            expect(result).toEqual(handles[0]);
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
