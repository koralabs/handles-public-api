# R2-only snapshot storage

## Root cause and contract

The snapshot client previously called a shared object-store factory only inside the publish handler. Missing R2 settings could select ambient AWS/S3 behavior, or surface only after the worker started. The reader and stale-snapshot check also retained an AWS website fallback. This change corrects configuration at startup and removes those fallback paths; it is not an IAM or credential-retirement operation.

The installed npmjs `@koralabs/kora-labs-common@6.21.1` tarball is pinned in package.json and package-lock.json, with the publisher's integrity `sha512-wR8Oy54ir6mKdrq9iL1pBH4+lqK53XuocdBboJynkQsV+sizuA3iwOqHUVo6gNqvBAbVxbYwD4RnCJAhw6Ti4g==`. No linked package or unpublished version is used.

The real shared `objectStoreConfig()` validates nonblank R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY; KORA_OBJECT_STORE may be absent or r2 only. It returns an explicit endpoint, credentials and region auto. App.initialize validates before routes/listening. RedisHandlesStore.initialize validates before starting a cache worker (including scanner startup). Snapshot module initialization captures this configuration before a handler can run. Errors propagate; no logging-and-continuing fallback is added.

SNAPSHOT_BUCKET selects the R2 bucket; its existing api.handle.me bucket-name default is transport-independent. SNAPSHOT_BASE_URL must explicitly identify the R2 bucket public URL when reading/restoring/checking snapshot age. The reader and failure-age check share getSnapshotUrl; no AWS URL is synthesized. Existing gzip/deflate format, verification, snapshot admission fences, archive retention, key layout and worker schedules are unchanged.

## Tests

- App startup rejects each missing/blank credential setting and the retired s3 selector before listening; removing real factory validation makes those tests fail.
- Snapshot module imports reject missing settings without invoking a worker; moving validation back into the handler makes those tests fail.
- URL tests cover trailing slashes and absent/empty/whitespace settings; reinstating AWS defaults fails those assertions.
- The real SDK client performs PUT, GET byte comparison, public-reader byte comparison, DELETE and confirmed404 against an owned local HTTPS server. Only its ephemeral certificate is trusted; TLS verification stays enabled. Endpoint/credential/region signing and persisted bytes are asserted. No SDK client/factory mock replaces this behavior. HTTPS matches actual R2 and avoids the SDK HTTP handler's dynamic-import limitation in Jest's VM.
- Existing real Valkey integration/native transaction tests are retained. Test setup uses explicit dummy R2 settings under the network/AWS guard, never workstation credentials or live R2.

## Production SDK packaging

The API Rollup configuration bundles `@aws-sdk/client-s3`; it is not an external. This preview build first installs the runtime-only `rollup.package.json` manifest into dist for the actual externals, then Rollup bundles application dependencies from the root lock-installed graph. The built `dist/lambdas/snapshot.js` successfully imports and constructs its explicit R2 client even with bare S3-package resolution deliberately blocked. Therefore this consumer does not need a speculative devDependency-to-dependency move. The verified artifact result is recorded with the rollout receipts.

## Deployment verification

The snapshot module exports createSnapshotObjectStoreClient, SNAPSHOT_BUCKET and the three SDK commands for installed-client verification without calling its business handler. After each normal Actions environment deploy, verify both boxes using that installed module and its configured bucket: PUT one `_verify/<env>-<box>-<epoch>.txt`, GET and compare bytes, DELETE, then GET confirming404. Record environment, box, deployment ID, bucket, scratch key and results; never print endpoint or credentials. Do not run a scanner/snapshot handler. Box access is coordinated with infrastructure ownership.

KMS hydration, JWT and metadata bootstrap retirement remain separate and held pending the actual two-box dependency census. No IAM, AWS table, financial, signing or contract operation is part of this change.
