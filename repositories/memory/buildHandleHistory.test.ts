import { MemoryHandlesRepository } from './handles.repository';
import { handlesFixture } from './tests/fixtures/handles';

describe('buildHandleHistory', () => {
    const repo = new MemoryHandlesRepository();
    it('should log the correct old and new value', () => {
        const newHandle = {
            ...handlesFixture[0],
            resolved_addresses: {
                ada: 'taco_addr'
            }
        };
        const oldHandle = handlesFixture[0];

        const history = repo.Internal.buildHandleHistory(newHandle, oldHandle);

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
