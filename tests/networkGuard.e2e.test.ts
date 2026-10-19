import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

if (process.env.AWS_SHARED_CREDENTIALS_FILE !== '/dev/null' || process.env.AWS_CONFIG_FILE !== '/dev/null' ||
    process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_PROFILE ||
    process.env.AWS_EC2_METADATA_DISABLED !== 'true') throw new Error('Integration worker loaded before AWS isolation');

// Invariant: permitting the owned real Valkey fixture never opens an AWS exception.
// Removing the integration worker setup/transport check attempts a real AWS endpoint instead.
it('keeps an unfaked AWS client blocked in the real-Valkey integration profile', async () => {
    const client = new S3Client({ region: 'us-east-1', endpoint: 'https://s3.us-east-1.amazonaws.com',
        credentials: { accessKeyId: 'unit-test-only', secretAccessKey: 'unit-test-only' }, maxAttempts: 1 });
    try { await expect(client.send(new ListBucketsCommand({}))).rejects.toThrow('Test network denied'); }
    finally { client.destroy(); }
});
