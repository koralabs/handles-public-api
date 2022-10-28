import { writeFileSync, unlinkSync } from 'fs';
import { delay } from '../../utils/util';
import { handlesFixture } from './fixtures/handles';
import { HandleStore } from './HandleStore';

describe('HandleStore tests', () => {
    const filePath = 'storage/handles-test.json';

    beforeAll(() => {
        // populate storage
        handlesFixture.forEach((handle) => {
            HandleStore.save(handle);
        });

        // create test file
        writeFileSync(filePath, '{}');
    });

    afterAll(() => {
        unlinkSync(filePath);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('saveFile tests', () => {
        it('should not allow saving if file is locked', async () => {
            HandleStore.saveFile(123, 'some-hash', filePath, async () => {
                await delay(1000);
            });
            await delay(100);
            const saved = await HandleStore.saveFile(345, 'some-hash', filePath);
            await delay(1000);
            expect(saved).toEqual(false);
        });
    });

    describe('getFile tests', () => {
        it('should not allow reading if file is locked', async () => {
            await HandleStore.saveFile(123, 'some-hash', filePath);
            const file = await HandleStore.getFile(filePath);
            expect(file).toEqual({
                slot: 123,
                hash: 'some-hash',
                schemaVersion: 1,
                handles: expect.any(Object)
            });
            HandleStore.saveFile(123, 'some-hash', filePath, async () => {
                await delay(1000);
            });
            await delay(100);
            const locked = await HandleStore.getFile(filePath);
            expect(locked).toEqual(null);
        });
    });
});
