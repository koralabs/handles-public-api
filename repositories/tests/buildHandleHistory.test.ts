import { HandlesMemoryStore } from '../../stores/memory';
import { RedisHandlesStore } from '../../stores/redis';
import { HandlesRepository } from '../handlesRepository';
import { handlesFixture } from './fixtures/handles';
jest.spyOn(HandlesMemoryStore.prototype as any, '_saveHandlesFile').mockImplementation();
jest.spyOn(HandlesMemoryStore.prototype, 'initialize').mockImplementation();

for (const store of [HandlesMemoryStore, RedisHandlesStore]) {
    describe('buildHandleHistory', () => {
        const repo = new HandlesRepository(new store());
        it('should log the correct old and new value', async () => {
            const newHandle = {
                ...handlesFixture[0],
                resolved_addresses: {
                    ada: 'taco_addr'
                }
            };
            const oldHandle = handlesFixture[0];

            const history = await repo.Internal.buildHandleHistory(newHandle, oldHandle);

            expect(history).toEqual({
                new: {
                    resolved_addresses: {
                        ada: 'taco_addr'
                    }
                },
                old: { resolved_addresses: { ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q' } }
            });
        });

        it('should not add history if nothing changes', () => {
            const history = repo.Internal.buildHandleHistory(handlesFixture[0], handlesFixture[0]);

            expect(history).toEqual(null);
        });
    });
}