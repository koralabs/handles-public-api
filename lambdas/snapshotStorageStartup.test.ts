// Invariant: snapshot worker imports fail immediately, not inside the later publish catch.
// Removing module-level objectStoreConfig validation allows these imports to resolve.
describe('snapshot storage startup', () => {
    const original = { ...process.env };
    afterEach(() => { process.env = { ...original }; jest.resetModules(); });

    it.each(['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'])('rejects module startup without %s', async (field) => {
        delete process.env[field];
        await expect(import('./snapshot.app')).rejects.toThrow('R2 object store requires');
    });

    it('does not fall back to AWS when the legacy selector is supplied', async () => {
        process.env.KORA_OBJECT_STORE = 's3';
        await expect(import('./snapshot.app')).rejects.toThrow('AWS S3 is retired');
    });
});
