import { HandleStore } from '.';
import { HandleHistory } from '../interfaces/handleStore.interfaces';
import { slotHistoryFixture } from '../tests/fixtures/handles';

describe('saveSlotHistory', () => {
    beforeEach(() => {
        HandleStore.slotHistoryIndex = new Map(
            Object.keys(slotHistoryFixture).map((k) => {
                const slot = parseInt(k);
                return [slot, slotHistoryFixture[slot]];
            })
        );
    });

    afterEach(() => {
        HandleStore.slotHistoryIndex = new Map();
        jest.clearAllMocks();
    });

    it('should save slot history', () => {
        const hex = 'nacho-hex';
        const history: HandleHistory = {
            old: null,
            new: { name: 'nacho' }
        };
        HandleStore.saveSlotHistory({ handleHistory: history, hex, slotNumber: 5 });
        expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
            [0, {}],
            [
                1,
                {
                    'barbacoa-hex': { new: { resolved_addresses: { ada: '123' } }, old: null },
                    'burrito-hex': { new: { resolved_addresses: { ada: '123' } }, old: null },
                    'taco-hex': { new: { resolved_addresses: { ada: '123' } }, old: null }
                }
            ],
            [
                2,
                {
                    'barbacoa-hex': {
                        new: { resolved_addresses: { ada: '456' } },
                        old: { resolved_addresses: { ada: '123' } }
                    }
                }
            ],
            [
                3,
                {
                    'burrito-hex': {
                        new: { resolved_addresses: { ada: '456' } },
                        old: { resolved_addresses: { ada: '123' } }
                    }
                }
            ],
            [
                4,
                {
                    'barbacoa-hex': {
                        new: { resolved_addresses: { ada: '789' } },
                        old: { resolved_addresses: { ada: '456' } }
                    }
                }
            ],
            [5, { 'nacho-hex': { new: { name: 'nacho' }, old: null } }]
        ]);
    });

    it('should remove slot indexes from the storage if they are old', () => {
        const hex = 'nacho-hex';
        const history: HandleHistory = {
            old: null,
            new: { name: 'nacho' }
        };

        // setting max slot to 2 which means it will be 3 (5 - 2)
        HandleStore.saveSlotHistory({ handleHistory: history, hex, slotNumber: 5, maxSlots: 2 });

        // expecting 0, 1, 2 to be removed
        expect(Array.from(HandleStore.slotHistoryIndex.keys())).toEqual([3, 4, 5]);

        // saving new slot history should remove 3 and add 6
        const hex2 = 'nacho-hex2';
        const history2: HandleHistory = {
            old: null,
            new: { name: 'nacho2' }
        };

        HandleStore.saveSlotHistory({ handleHistory: history2, hex: hex2, slotNumber: 6, maxSlots: 2 });

        expect(Array.from(HandleStore.slotHistoryIndex.keys())).toEqual([4, 5, 6]);
    });

    it('should update slot with new handle history', () => {
        const hex = 'nacho-hex';
        const history: HandleHistory = {
            old: null,
            new: { name: 'nacho' }
        };
        HandleStore.saveSlotHistory({ handleHistory: history, hex, slotNumber: 4 });
        expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
            [0, {}],
            [1, expect.any(Object)],
            [2, expect.any(Object)],
            [3, expect.any(Object)],
            [
                4,
                {
                    'barbacoa-hex': {
                        new: { resolved_addresses: { ada: '789' } },
                        old: { resolved_addresses: { ada: '456' } }
                    },
                    'nacho-hex': { new: { name: 'nacho' }, old: null }
                }
            ]
        ]);
    });
});
