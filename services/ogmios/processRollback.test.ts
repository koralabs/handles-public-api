import { IHandlesRepository } from '@koralabs/kora-labs-common';
import { MemoryHandlesRepository } from '../../repositories/memory/handles.repository';
import OgmiosService from './ogmios.service';

const ogmios = new OgmiosService(MemoryHandlesRepository as unknown as IHandlesRepository);

describe('processRollback', () => {
    it('should apply previous changes to handle', () => {
        const rewindSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'rewindChangesToSlot');
        const rollbackSlot = 1234;
        const rollbackHash = '1234-hash';
        const tipSlot = 2000;
        ogmios['processRollback']({ slot: rollbackSlot, id: rollbackHash }, { slot: tipSlot, id: 'tip_hash', height: 4 });

        expect(rewindSpy).toHaveBeenCalledWith({ slot: rollbackSlot, hash: rollbackHash, lastSlot: tipSlot });
    });

    it('should rollback to genesis if point is origin', () => {
        const rollbackSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'rollBackToGenesis');
        ogmios['processRollback']('origin', 'origin');

        expect(rollbackSpy).toHaveBeenCalledTimes(1);
    });
});
