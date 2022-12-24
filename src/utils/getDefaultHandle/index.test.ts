import { getDefaultHandle } from './index';
import { handles, handlesWithDifferentLengths, handlesWithDifferentSlotNumbers, ogHandles } from './fixtures/handles';

describe('getDefaultHandle', () => {
    it('should sort OGs', () => {
        const handle = getDefaultHandle(ogHandles);
        expect(handle).toEqual(ogHandles[0]);
    });

    it('should sort only one OG', () => {
        const handle = getDefaultHandle([ogHandles[1]]);
        expect(handle).toEqual(ogHandles[1]);
    });

    it('should sort if there are multiple lengths', () => {
        const handle = getDefaultHandle(handlesWithDifferentLengths);
        expect(handle).toEqual(handlesWithDifferentLengths[1]);
    });

    it('should sort if there are multiple slot numbers', () => {
        const handle = getDefaultHandle(handlesWithDifferentSlotNumbers);
        expect(handle).toEqual(handlesWithDifferentSlotNumbers[2]);
    });

    it('should sort alphabetically', () => {
        const handle = getDefaultHandle(handles);
        expect(handle).toEqual(handles[1]);
    });
});
