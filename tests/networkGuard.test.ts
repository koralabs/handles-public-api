import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import https from 'node:https';

// This runs at test-module evaluation, not in a late beforeEach after SDK/app imports.
if (process.env.AWS_SHARED_CREDENTIALS_FILE !== '/dev/null' || process.env.AWS_CONFIG_FILE !== '/dev/null' ||
    process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_PROFILE ||
    process.env.AWS_EC2_METADATA_DISABLED !== 'true' || process.env.AWS_ENDPOINT_URL !== 'http://aws-test.invalid') {
    throw new Error('AWS isolation was not installed before test module evaluation');
}

// Invariant: each Jest worker denies a real unfaked AWS client before any network.
// Removing the worker setup/preload either exposes profile credentials or changes this denial.
it('blocks an unfaked AWS client inside a Jest worker', async () => {
    const client = new S3Client({ region: 'us-east-1', endpoint: 'https://s3.us-east-1.amazonaws.com',
        credentials: { accessKeyId: 'unit-test-only', secretAccessKey: 'unit-test-only' }, maxAttempts: 1 });
    try { await expect(client.send(new ListBucketsCommand({}))).rejects.toThrow('Test network denied'); }
    finally { client.destroy(); }
});

// Invariant: replacing fetch or using the lower-level HTTP module cannot regain transport.
// Removing the process-wide HTTPS hook produces a socket attempt rather than this exact code.
it('blocks direct HTTPS in the worker independently of fetch mocks', () => {
    expect(() => https.get('https://dynamodb.us-east-1.amazonaws.com')).toThrow(expect.objectContaining({ code: 'TEST_NETWORK_DENIED' }));
});
