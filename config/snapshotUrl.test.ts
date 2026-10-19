// Invariant: snapshot reads and stale-snapshot checks share the configured R2 public URL.
// Restoring the AWS default or separate hardcoded URL breaks these results.
describe('snapshot public URL', () => {
    const previous = process.env.SNAPSHOT_BASE_URL;
    afterEach(() => {
        if (previous === undefined) delete process.env.SNAPSHOT_BASE_URL;
        else process.env.SNAPSHOT_BASE_URL = previous;
        jest.resetModules();
    });
    it('uses the configured bucket public URL without duplicate slashes', async () => {
        process.env.SNAPSHOT_BASE_URL = ' https://local-fixture.invalid/snapshots/// ';
        const { getSnapshotUrl } = await import('./index');
        expect(getSnapshotUrl('preprod', 7)).toBe('https://local-fixture.invalid/snapshots/preprod/utxo-snapshot/7/handles_utxos.gz');
    });
    it.each([undefined, '', '   '])('refuses a missing public URL instead of falling back to AWS: %s', async value => {
        if (value === undefined) delete process.env.SNAPSHOT_BASE_URL;
        else process.env.SNAPSHOT_BASE_URL = value;
        const { getSnapshotUrl } = await import('./index');
        expect(() => getSnapshotUrl('mainnet', 7)).toThrow('SNAPSHOT_BASE_URL must be set');
    });
});
