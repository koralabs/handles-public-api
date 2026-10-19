import https from 'node:https';
import { AddressInfo } from 'node:net';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NodeHttpHandler } from '@smithy/node-http-handler';

// Invariant: the actual snapshot client uses explicit R2 configuration for write/read/delete,
// and the public reader consumes the same snapshot bytes, without any AWS credentials.
// Removing the client factory's config or restoring the AWS reader URL fails these outcomes.
it('round trips snapshot bytes through the actual SDK and configured public reader', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-r2-tls-'));
    const keyFile = join(dir, 'key.pem');
    const certFile = join(dir, 'cert.pem');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
        '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', keyFile, '-out', certFile], { stdio: 'ignore' });
    const cert = readFileSync(certFile);
    const objects = new Map<string, Buffer>();
    const requests: { method: string; authorization: string }[] = [];
    const server = https.createServer({ key: readFileSync(keyFile), cert }, async (req, res) => {
        const key = req.url!.split('?')[0];
        requests.push({ method: req.method!, authorization: `${req.headers.authorization ?? ''}` });
        if (req.method === 'PUT') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            objects.set(key, Buffer.concat(chunks));
            res.setHeader('etag', '"local-r2-etag"');
            res.end();
        } else if (req.method === 'DELETE') {
            objects.delete(key); res.writeHead(204); res.end();
        } else if (objects.has(key)) {
            res.end(objects.get(key));
        } else {
            res.writeHead(404, { 'content-type': 'application/xml' });
            res.end('<Error><Code>NoSuchKey</Code></Error>');
        }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const endpoint = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const previous = { ...process.env };
    process.env.R2_ENDPOINT = endpoint;
    process.env.SNAPSHOT_BUCKET = 'local-snapshot-fixture';
    process.env.SNAPSHOT_BASE_URL = `${endpoint}/local-snapshot-fixture/`;
    let client: import('@aws-sdk/client-s3').S3Client | undefined;
    try {
        // Real shared plaintext validation must reject legacy config before storage work.
        const { validatePlaintextStartup } = await import('../utils/startupEnvironment');
        process.env.API_STORAGE_FIXTURE_ENC = 'dummy-retired-ciphertext';
        try { await expect(validatePlaintextStartup()).rejects.toThrow('AWS KMS is retired'); }
        finally { delete process.env.API_STORAGE_FIXTURE_ENC; }
        await expect(validatePlaintextStartup()).resolves.toEqual([]);
        const storage = await import('./snapshot');
        const { getSnapshotUrl } = await import('../config');
        client = storage.createSnapshotObjectStoreClient();
        // Trust only this ephemeral certificate; normal TLS verification remains enabled.
        (client.config.requestHandler as NodeHttpHandler).updateHttpClientConfig('httpsAgent', new https.Agent({ ca: cert }));
        const Key = 'preview/utxo-snapshot/7/handles_utxos.gz';
        const Body = Buffer.from('owned-local-snapshot-bytes');
        const params = { Bucket: storage.SNAPSHOT_BUCKET, Key };
        const written = await client.send(new storage.PutObjectCommand({ ...params, Body }));
        expect(written.ETag).toBe('"local-r2-etag"');
        const read = await client.send(new storage.GetObjectCommand(params));
        expect(Buffer.from(await read.Body!.transformToByteArray())).toEqual(Body);
        const publicRead = await new Promise<Buffer>((resolve, reject) => {
            https.get(getSnapshotUrl('preview', 7), { ca: cert }, response => {
                const chunks: Buffer[] = [];
                response.on('data', chunk => chunks.push(Buffer.from(chunk)));
                response.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', reject);
        });
        expect(publicRead).toEqual(Body);
        expect(objects.get(`/local-snapshot-fixture/${Key}`)).toEqual(Body);
        await client.send(new storage.DeleteObjectCommand(params));
        expect(objects.size).toBe(0);
        await expect(client.send(new storage.GetObjectCommand(params))).rejects.toMatchObject({
            $metadata: { httpStatusCode: 404 }
        });
        expect(requests.filter(r => ['PUT', 'DELETE'].includes(r.method)).map(r => r.method)).toEqual(['PUT', 'DELETE']);
        expect(requests.filter(r => ['PUT', 'DELETE'].includes(r.method)).every(r =>
            r.authorization.includes('Credential=test-only-access/') && r.authorization.includes('/auto/s3/aws4_request'))).toBe(true);
    } finally {
        client?.destroy();
        process.env = previous;
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
        unlinkSync(keyFile); unlinkSync(certFile); rmdirSync(dir);
    }
});
