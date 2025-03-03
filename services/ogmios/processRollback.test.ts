import { IHandlesProvider } from '@koralabs/kora-labs-common';
import { MemoryHandlesProvider } from '../../repositories/memory';
import OgmiosService from './ogmios.service';

const ogmios = new OgmiosService(MemoryHandlesProvider as unknown as IHandlesProvider);

describe('processRollback', () => {
    it('should apply previous changes to handle', () => {
        const rewindSpy = jest.spyOn(MemoryHandlesProvider.prototype, 'rewindChangesToSlot');
        const rollbackSlot = 1234;
        const rollbackHash = '1234-hash';
        const tipSlot = 2000;
        ogmios['processRollback']({ slot: rollbackSlot, id: rollbackHash }, { slot: tipSlot, id: 'tip_hash', height: 4 });

        expect(rewindSpy).toHaveBeenCalledWith({ slot: rollbackSlot, hash: rollbackHash, lastSlot: tipSlot });
    });

    it('should rollback to genesis if point is origin', () => {
        const rollbackSpy = jest.spyOn(MemoryHandlesProvider.prototype, 'rollBackToGenesis');
        ogmios['processRollback']('origin', 'origin');

        expect(rollbackSpy).toHaveBeenCalledTimes(1);
    });
});
