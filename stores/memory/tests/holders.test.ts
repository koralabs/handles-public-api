import { Holder } from '@koralabs/kora-labs-common';
import { HandlesMemoryStore, HandleStore } from '..';
import { HandlesRepository } from '../../../repositories/handlesRepository';
import { createRandomHandles, performRandomHandleUpdates } from './fixtures/handles';
const repo = new HandlesRepository(new HandlesMemoryStore());

describe('holder index integrity', () => {
    it('holder index should be accurate', async () => {
        await createRandomHandles(1000, true);
        await performRandomHandleUpdates(1000, 1001);
        const testHolderIndex = new Map<string, Holder>();
        const handles = repo.getAllHandles().sort((a,b) => a.updated_slot_number - b.updated_slot_number)
        for (let i = 0; i<handles.length;i++) {
            const handle = handles[i];
            const holder = testHolderIndex.get(handle.holder);
            if (!holder) {
                
                testHolderIndex.set(handle.holder, {
                    defaultHandle: handle.default_in_wallet,
                    handles: [{name:handle.name, og_number: handle.og_number, created_slot_number: handle.created_slot_number}],
                    knownOwnerName: '',
                    manuallySet: false,
                    type: 'wallet'
                } as unknown as any);
            } 
            else {
                holder.defaultHandle = handle.default_in_wallet;
                holder.handles.push({name:handle.name, og_number: handle.og_number, created_slot_number: handle.created_slot_number});
            } 
        }
        expect(HandleStore.holderIndex).toEqual(testHolderIndex);
    });
});