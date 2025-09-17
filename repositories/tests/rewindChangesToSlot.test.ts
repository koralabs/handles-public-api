import { IndexNames, Logger } from '@koralabs/kora-labs-common';
import { HandlesMemoryStore } from '../../stores/memory';
import { HandlesRepository } from '../handlesRepository';
import { handlesFixture } from './fixtures/handles';

//for (const store of [HandlesMemoryStore, RedisHandlesStore]) {
for (const store of [HandlesMemoryStore]) {
    const storeInstance = new store();
    const repo = new HandlesRepository(storeInstance);
    repo.initialize();
    repo.rollBackToGenesis();
    
    describe('rewindChangesToSlot', () => {
        beforeEach(async () => {
            // populate storage
            handlesFixture.map(handle => repo.save(handle))
            storeInstance.addValueToOrderedSet(IndexNames.SLOT_HISTORY, 0, {})
        });

        afterEach(() => {
            handlesFixture.map(handle => repo.removeHandle(handle, 0))
            storeInstance.removeValuesFromOrderedSet(IndexNames.SLOT_HISTORY, Infinity)
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
            const res = repo.search().handles
            expect(res.length).toEqual(0);
            expect(Object.entries(storeInstance.getIndex(IndexNames.SLOT_HISTORY))).toEqual([]);
            expect(setMetricsSpy).toHaveBeenCalledWith({ currentBlockHash: hash, currentSlot: slot, lastSlot });
        });

        it('Should rewind to the slot 2 and and reset the ada address to the old address', async () => {
            const slot = handlesFixture.find(h => h.name == "burrito")?.updated_slot_number ?? 0;
            const hash = 'hash2';
            const lastSlot = 10;
            const setMetricsSpy = jest.spyOn(repo, 'setMetrics').mockImplementation();
            
            repo.save({
                ...handlesFixture[1],
                updated_slot_number: Date.now() + 50,
                resolved_addresses: {ada:'addr_test1zqdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc79r' }
            }, handlesFixture[1])

            repo.save({
                ...handlesFixture[2],
                updated_slot_number: Date.now() + 60,
                resolved_addresses: {ada:'addr_test1zqdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc79r' }
            }, handlesFixture[2])

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