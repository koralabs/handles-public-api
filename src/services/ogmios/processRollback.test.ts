import { processRollback } from './processRollback';
import { HandleStore } from '../../repositories/memory/HandleStore';

jest.mock('../../repositories/memory/HandleStore');

describe('processRollback', () => {
    it('should apply previous changes to handle', () => {
        const rewindSpy = jest.spyOn(HandleStore, 'rewindChangesToSlot');
        const slotNumber = 1234;
        processRollback({ slot: slotNumber, hash: 'some_hash' });

        expect(rewindSpy).toHaveBeenCalledWith(slotNumber);
    });

    it('should rollback to genesis if point is origin', () => {
        const rollbackSpy = jest.spyOn(HandleStore, 'rollBackToGenesis');
        processRollback('origin');

        expect(rollbackSpy).toHaveBeenCalledTimes(1);
    });
});
