import { HandleHistory } from '@koralabs/kora-labs-common';
import { MemoryHandlesProvider } from '.';
import { HandleStore } from './handleStore';
import { slotHistoryFixture } from './tests/fixtures/handles';
const repo = new MemoryHandlesProvider();

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
        const handleName = 'nacho';
        const history: HandleHistory = {
            old: null
        };
        repo.Internal.saveSlotHistory({ handleHistory: history, handleName, slotNumber: 5 });
        expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
            [0, {}],
            [
                1,
                {
                    barbacoa: { old: null },
                    burrito: { old: null },
                    taco: { old: null }
                }
            ],
            [
                2,
                {
                    barbacoa: {
                        old: { resolved_addresses: { ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q' } }
                    }
                }
            ],
            [
                3,
                {
                    burrito: {
                        old: { resolved_addresses: { ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q' } }
                    }
                }
            ],
            [
                4,
                {
                    barbacoa: {
                        old: { resolved_addresses: { ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q' } }
                    }
                }
            ],
            [5, { nacho: { old: null } }]
        ]);
    });

    it('should remove slot indexes from the storage if they are old', () => {
        const handleName = 'nacho';
        const history: HandleHistory = {
            old: null
        };

        // setting max slot to 2 which means it will be 3 (5 - 2)
        repo.Internal.saveSlotHistory({ handleHistory: history, handleName, slotNumber: 5, maxSlots: 2 });

        // expecting 0, 1, 2 to be removed
        expect(Array.from(HandleStore.slotHistoryIndex.keys())).toEqual([3, 4, 5]);

        // saving new slot history should remove 3 and add 6
        const handleName2 = 'nacho2';
        const history2: HandleHistory = {
            old: null
        };

        repo.Internal.saveSlotHistory({ handleHistory: history2, handleName: handleName2, slotNumber: 6, maxSlots: 2 });

        expect(Array.from(HandleStore.slotHistoryIndex.keys())).toEqual([4, 5, 6]);
    });

    it('should update slot with new handle history', () => {
        const handleName = 'nacho';
        const history: HandleHistory = {
            old: null
        };
        repo.Internal.saveSlotHistory({ handleHistory: history, handleName, slotNumber: 4 });
        expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
            [0, {}],
            [1, expect.any(Object)],
            [2, expect.any(Object)],
            [3, expect.any(Object)],
            [
                4,
                {
                    barbacoa: {
                        old: { resolved_addresses: { ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q' } }
                    },
                    nacho: { old: null }
                }
            ]
        ]);
    });
});
