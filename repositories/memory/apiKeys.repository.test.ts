import MemoryApiKeysRepository from './apiKeys.repository';

describe('MemoryApiKeysRepository Tests', () => {
    describe('get function tests', () => {
        it('Should fail if no key is provided', async () => {
            const repo = new MemoryApiKeysRepository();
            try {
                await repo.get();
            } catch (error: any) {
                expect(error.message).toEqual('Not found');
            }
        });

        it('Should get key', async () => {
            const repo = new MemoryApiKeysRepository();
            const result = await repo.get('test');
            expect(result).toEqual({ id: 'key_test' });
        });
    });
});
