// Common 6.21.2 keeps this historic export as a plaintext-only startup check.
// It rejects leftover ciphertext settings and never decrypts or calls AWS.
export { hydrateKmsEnvironment as validatePlaintextStartup } from '@koralabs/kora-labs-common/aws';
