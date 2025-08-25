import { HandlesRepository } from '../../../repositories/handlesRepository';
import { HandlesMemoryStore } from '../../../stores/memory';
import { RedisHandlesStore } from '../../../stores/redis';
import OgmiosService from '../ogmios.service';

const ogmios = new OgmiosService(new HandlesRepository(new HandlesMemoryStore()));

//for (const store of [HandlesMemoryStore, RedisHandlesStore]) {
for (const store of [RedisHandlesStore]) {
    const storeInstance = new store();
    const repo = new HandlesRepository(storeInstance);
    repo.initialize();
    repo.rollBackToGenesis();

    describe('processRollback', () => {
        it('should apply previous changes to handle', () => {
            const rewindSpy = jest.spyOn(HandlesRepository.prototype, 'rewindChangesToSlot');
            const rollbackSlot = 1234;
            const rollbackHash = '1234-hash';
            const tipSlot = 2000;
            ogmios['processRollback']({ slot: rollbackSlot, id: rollbackHash }, { slot: tipSlot, id: 'tip_hash', height: 4 });

            expect(rewindSpy).toHaveBeenCalledWith({ slot: rollbackSlot, hash: rollbackHash, lastSlot: tipSlot });
        });

        it('should rollback to genesis if point is origin', () => {
            const rollbackSpy = jest.spyOn(HandlesMemoryStore.prototype, 'rollBackToGenesis');
            ogmios['processRollback']('origin', 'origin');

            expect(rollbackSpy).toHaveBeenCalledTimes(1);
        });
    });
}