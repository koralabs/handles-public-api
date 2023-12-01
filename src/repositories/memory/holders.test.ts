import { HandleStore } from "./HandleStore";
import { HolderAddressIndex } from "./interfaces/handleStore.interfaces";
import { createRandomHandles, performRandomHandleUpdates } from "./tests/fixtures/handles";

describe('holder index integrity', () => {
    it('holder index should be accurate', async () => {
        await createRandomHandles(1000, true);
        await performRandomHandleUpdates(1000, 1001);
        const testHolderIndex = new Map<string, HolderAddressIndex>();
        const handles = HandleStore.getHandles().sort((a,b) => a.updated_slot_number - b.updated_slot_number)
        for (let i = 0; i<handles.length;i++) {
            const handle = handles[i];
            const holder = testHolderIndex.get(handle.holder);
            if (!holder) {
                const set = new Set<string>();
                set.add(handle.name);
                testHolderIndex.set(handle.holder, {
                    defaultHandle: handle.default_in_wallet,
                    handles: set,
                    knownOwnerName: '',
                    manuallySet: false,
                    type: 'wallet'
                });
            } 
            else {
                holder.defaultHandle = handle.default_in_wallet;
                holder.handles.add(handle.name);
            } 
        }
        expect(HandleStore.holderAddressIndex).toEqual(testHolderIndex);
    });
});