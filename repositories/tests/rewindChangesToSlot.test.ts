import { IndexNames, Logger } from '@koralabs/kora-labs-common';
import { RedisHandlesStore } from '../../stores/redis';
import { HandlesRepository } from '../handlesRepository';
import { handlesFixture, slotHistoryFixture } from './fixtures/handles';

//for (const store of [HandlesMemoryStore, RedisHandlesStore]) {
for (const store of [RedisHandlesStore]) {
    const storeInstance = new store();
    const repo = new HandlesRepository(storeInstance);
    repo.initialize();
    repo.rollBackToGenesis();
    
    describe('rewindChangesToSlot', () => {
        beforeEach(async () => {
            // populate storage
            for (const key in handlesFixture) {
                const handle = handlesFixture[key];
                repo.save(handle);
            }

            // set the slotHistoryIndex
            for(const [slot, history] of slotHistoryFixture) {
                storeInstance.setValueOnIndex(IndexNames.SLOT_HISTORY, slot, history)
            }
        });

        afterEach(() => {
            for (const key in handlesFixture) {
                const handle = handlesFixture[key];
                repo.removeHandle(handle, 0);
            }

            storeInstance.removeKeyFromIndex(IndexNames.SLOT_HISTORY, Infinity)
            jest.clearAllMocks();
        });

        it('Should rewind to the slot 0 and remove all handle', async () => {
            jest.spyOn(Logger, 'log');
            const setMetricsSpy = jest.spyOn(repo, 'setMetrics').mockImplementation();

            // We should have 3 handles before the rollback
            expect(repo.search().handles).toHaveLength(3);

            const slot = 0;
            const hash = 'hash0';
            const lastSlot = 10;

            repo.rewindChangesToSlot({ slot, hash, lastSlot });

            // and none after the rollback
            expect(repo.search().handles.length).toEqual(0);
            expect(Object.entries(storeInstance.getIndex(IndexNames.SLOT_HISTORY))).toEqual([]);
            expect(setMetricsSpy).toHaveBeenCalledWith({ currentBlockHash: hash, currentSlot: slot, lastSlot });
        });

        it('Should rewind to the slot 2 and and reset the ada address to the old address', async () => {
            const slot = 2;
            const hash = 'hash2';
            const lastSlot = 10;
            const setMetricsSpy = jest.spyOn(repo, 'setMetrics').mockImplementation();

            repo.rewindChangesToSlot({ slot, hash, lastSlot });

            // and none after the rollback
            expect(repo.getHandle('burrito')?.resolved_addresses.ada).toEqual('addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q');
            expect(repo.getHandle('barbacoa')?.resolved_addresses.ada).toEqual('addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q');

            expect(setMetricsSpy).toHaveBeenCalledWith({ currentBlockHash: hash, currentSlot: slot, lastSlot });
        });

        it('Should get entire handle during rewind when burn happens', async () => {
            const slot = 4;
            const hash = 'hash4';
            const lastSlot = 10;
            jest.spyOn(repo, 'setMetrics').mockImplementation();

            repo.removeHandle(repo.getHandle('taco')!, 5);

            repo.rewindChangesToSlot({ slot, hash, lastSlot });

            // should pull back the entire handle
            expect(repo.getHandle('taco')).toEqual({ ...handlesFixture[2], holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70' });
        });
    });
}