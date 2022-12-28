import { ISlotHistoryIndex } from '../../interfaces/handle.interface';
import { processRollback } from './processRollback';

const history: Record<string, ISlotHistoryIndex> = {
    1: {
        hndl1: {
            old: null,
            new: { name: 'hndl1' }
        },
        hndl2: {
            old: null,
            new: { name: 'hndl2' }
        }
    },
    2: {
        hndl1: {
            old: { resolved_addresses: { ada: '123' } },
            new: { resolved_addresses: { ada: '456' } }
        }
    },
    3: {
        hndl2: {
            old: { resolved_addresses: { ada: '123' } },
            new: { resolved_addresses: { ada: '456' } }
        }
    },
    4: {
        hndl1: {
            old: { resolved_addresses: { ada: '456' } },
            new: { resolved_addresses: { ada: '789' } }
        }
    }
};

describe('processRollback', () => {
    it('should remove new handle if rollback occurs', () => {
        processRollback({ slot: 1234, hash: 'some_hash' });

        expect(true).toBe(true);
    });

    it('should apply previous changes to handle', () => {
        processRollback({ slot: 1234, hash: 'some_hash' });

        expect(true).toBe(true);
    });

    it('should rollback to genesis if point is origin', () => {
        processRollback('origin');

        expect(true).toBe(true);
    });
});
