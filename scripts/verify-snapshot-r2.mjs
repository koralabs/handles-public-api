import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [modulePath, env, box, deployId] = process.argv.slice(2);
if (modulePath !== '/function/snapshot.js' || !['preview', 'preprod', 'mainnet'].includes(env) || !['kora-sf', 'kora-rdm'].includes(box) || !/^[a-f0-9-]{36}$/.test(deployId ?? '')) {
    throw new Error('Usage: node verify-snapshot-r2.mjs <installed-snapshot-module> <env> <kora-sf|kora-rdm> <deploy-uuid>');
}

const key = `_verify/${env}-${box}-${Date.now()}.txt`;
const receipt = { env, box, deployId, bucket: undefined, key, put: false, getCompared: false, deleted: false, missing404: false };
let client;
let commands;
let putAttempted = false;
try {
    commands = await import(pathToFileURL(modulePath).href);
    receipt.modulePath = modulePath;
    receipt.moduleSha256 = createHash('sha256').update(readFileSync(modulePath)).digest('hex');
    receipt.sdkExecution = 'installed-app-bundled-factory';
    try { receipt.externalSdkResolution = createRequire(pathToFileURL(modulePath)).resolve('@aws-sdk/client-s3'); }
    catch { receipt.externalSdkResolution = 'not-installed-sdk-is-bundled'; }
    client = commands.createSnapshotObjectStoreClient();
    const credentials = await client.config.credentials();
    if (credentials.accessKeyId !== process.env.R2_ACCESS_KEY_ID || credentials.secretAccessKey !== process.env.R2_SECRET_ACCESS_KEY ||
        await client.config.region() !== 'auto' || (await client.config.endpoint()).hostname !== new URL(process.env.R2_ENDPOINT).hostname) {
        throw new Error('Installed factory does not match target snapshot R2 configuration');
    }
    receipt.targetConfigMatched = true;
    receipt.bucket = commands.SNAPSHOT_BUCKET;
    const params = { Bucket: receipt.bucket, Key: key };
    const body = Buffer.from(`API R2 scratch verification: ${env}/${box}/${deployId}`);
    putAttempted = true;
    const written = await client.send(new commands.PutObjectCommand({ ...params, Body: body }));
    receipt.put = true;
    receipt.putStatus = written.$metadata.httpStatusCode;
    const read = await client.send(new commands.GetObjectCommand(params));
    receipt.getStatus = read.$metadata.httpStatusCode;
    const bytes = Buffer.from(await read.Body.transformToByteArray());
    receipt.getCompared = bytes.equals(body);
    if (!receipt.getCompared) throw new Error('Scratch byte comparison failed');
} catch (error) {
    receipt.error = { name: error?.name, status: error?.$metadata?.httpStatusCode };
    process.exitCode = 1;
} finally {
    if (putAttempted) {
        const params = { Bucket: receipt.bucket, Key: key };
        try {
            const removed = await client.send(new commands.DeleteObjectCommand(params));
            receipt.deleted = true;
            receipt.deleteStatus = removed.$metadata.httpStatusCode;
            try {
                await client.send(new commands.GetObjectCommand(params));
            } catch (error) {
                receipt.missing404 = error?.$metadata?.httpStatusCode === 404;
            }
            if (!receipt.missing404) process.exitCode = 1;
        } catch (error) {
            receipt.cleanupError = { name: error?.name, status: error?.$metadata?.httpStatusCode };
            process.exitCode = 1;
        }
    }
    client?.destroy();
    // Never serialize SDK configuration/errors: they may contain endpoint or credentials.
    console.log(JSON.stringify(receipt));
}
