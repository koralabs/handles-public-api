import { HandleStore } from '.';
import { handlesFixture } from '../tests/fixtures/handles';

describe('buildHandleHistory', () => {
    it('should log the correct old and new value', () => {
        const newHandle = {
            ...handlesFixture[0],
            resolved_addresses: {
                ada: 'taco_addr'
            }
        };
        const oldHandle = handlesFixture[0];

        const history = HandleStore.buildHandleHistory(newHandle, oldHandle);

        expect(history).toEqual({
            new: { resolved_addresses: { ada: 'taco_addr' } },
            old: { resolved_addresses: { ada: '123' } }
        });
    });

    it('should not add history if nothing changes', () => {
        const history = HandleStore.buildHandleHistory(handlesFixture[0], handlesFixture[0]);

        expect(history).toEqual(null);
    });
});
