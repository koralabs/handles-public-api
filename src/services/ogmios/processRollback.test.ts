import { processRollback } from './processRollback';
import { HandleStore } from '../../repositories/memory/HandleStore';

jest.mock('../../repositories/memory/HandleStore');

describe('processRollback', () => {
    it('should apply previous changes to handle', () => {
        const rewindSpy = jest.spyOn(HandleStore, 'rewindChangesToSlot');
        const rollbackSlot = 1234;
        const rollbackHash = '1234-hash';
        const tipSlot = 2000;
        processRollback({ slot: rollbackSlot, hash: rollbackHash }, { slot: tipSlot, hash: 'tip_hash', blockNo: 4 });

        expect(rewindSpy).toHaveBeenCalledWith({ slot: rollbackSlot, hash: rollbackHash, lastSlot: tipSlot });
    });

    it('should rollback to genesis if point is origin', () => {
        const rollbackSpy = jest.spyOn(HandleStore, 'rollBackToGenesis');
        processRollback('origin', 'origin');

        expect(rollbackSpy).toHaveBeenCalledTimes(1);
    });
});
