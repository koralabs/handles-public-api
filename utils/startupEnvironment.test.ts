import { validatePlaintextStartup } from './startupEnvironment';

// Plaintext deployments must start without AWS and reject leftover ciphertext before app work.
// Removing the real shared check makes the encrypted-setting rejections disappear.
describe('plaintext startup', () => {
    const original = { ...process.env };
    afterEach(() => { process.env = { ...original }; });

    it('accepts plaintext settings with no AWS credentials or KMS flag', async () => {
        delete process.env.KORA_KMS_DISABLED;
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;
        process.env.API_STARTUP_FIXTURE = 'plaintext';
        await expect(validatePlaintextStartup()).resolves.toEqual([]);
        expect(process.env.API_STARTUP_FIXTURE).toBe('plaintext');
    });

    it.each(['API_STARTUP_FIXTURE_ENC', 'KMS_ENV_BUNDLE_ENC'])('rejects retired %s even if KMS was disabled', async field => {
        process.env.KORA_KMS_DISABLED = 'true';
        process.env[field] = 'dummy-retired-ciphertext';
        await expect(validatePlaintextStartup()).rejects.toThrow('AWS KMS is retired');
        expect(process.env[field]).toBe('dummy-retired-ciphertext');
    });
});
