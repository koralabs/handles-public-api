import { HandlesRepository } from '../handlesRepository';
import { MemoryHandlesProvider } from '../memory';
import { handles, handlesWithDifferentLengths, handlesWithDifferentSlotNumbers, ogHandles } from './fixtures/handles';
const repo = new HandlesRepository(new MemoryHandlesProvider());

describe('getDefaultHandle', () => {
    it('should sort OGs', () => {
        // @ts-ignore
        const handle = repo.getDefaultHandle(ogHandles);
        expect(handle).toEqual(ogHandles[0]);
    });

    it('should sort only one OG', () => {
        // @ts-ignore
        const handle = repo.getDefaultHandle([ogHandles[1]]);
        expect(handle).toEqual(ogHandles[1]);
    });

    it('should sort if there are multiple lengths', () => {
        // @ts-ignore
        const handle = repo.getDefaultHandle(handlesWithDifferentLengths);
        expect(handle).toEqual(handlesWithDifferentLengths[1]);
    });

    it('should sort if there are multiple slot numbers', () => {
        // @ts-ignore
        const handle = repo.getDefaultHandle(handlesWithDifferentSlotNumbers);
        expect(handle).toEqual(handlesWithDifferentSlotNumbers[2]);
    });

    it('should sort alphabetically', () => {
        // @ts-ignore
        const handle = repo.getDefaultHandle(handles);
        expect(handle).toEqual(handles[1]);
    });
});
