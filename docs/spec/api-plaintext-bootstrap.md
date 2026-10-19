# API plaintext bootstrap (common 6.21.2)

## Failure and correction

Legacy startup naming implied runtime KMS decryption, and scanner runtime classification depended on KORA_KMS_DISABLED. That crypto flag could suppress bootstrap errors despite having no relation to scanner import policy. Shared common6.21.2 removes KMS/decrypt and automatic EC2/ECS metadata helpers. The API now uses a clearly named centralized plaintext startup check and removes the dead crypto flag from scanner classification. This is an upstream dependency/consumer correction, not an IAM or secret mutation.

The real npmjs6.21.2 package is pinned with resolved URL and publisher integrity `sha512-SEhVC2X8yrGbEuBWuLmzedlOrp5KBzaENrpjoo6VZDmezXJwbNRiAgw0TXUqqSVg9SaLe2/V/VCCYNJA+3/VLA==`.

## Startup behavior

`utils/startupEnvironment.ts` aliases the shared compatibility export to validatePlaintextStartup. The historic library export name remains only at this single boundary: it is a check, not a decrypt operation. Do not delete the check: nonempty retired *_ENC/bundle settings must fail before application work. API, snapshot, scanner and sideload callers retain their existing import-order and bootstrap-error behavior. App.initialize also validates before routes/listening. Scanner error classification depends only on the explicit KORA_SCANNER_DEFER_IMPORTS flag, not a retired KMS flag. No production sideload or scanner handler is invoked for this change.

## JWT and configuration census

The API runtime source has no JWT sign/verify or jsonwebtoken caller, so assertJwtKeysConfigured is not applicable here; adding it would create an unused key dependency. No API-owned JWT_KEY_ID, *_ENC or KMS environment definitions exist in site.env. KORA_KMS_DISABLED was read only by scanner bootstrap and that read is removed. No live/shared operator setting is deleted by this consumer change.

Infrastructure's actual2026-10-19 two-box census found no encrypted settings or runtime KMS dependence, KMS disabled across86 effective Fn configs, and no current-layer drift. Evidence: `kora-self-hosted-apps/tmp/kms-jwt-census/{RESULTS.md,summary.json,r2-readiness.json,sfo.json,rdm.json}`. Global legacy JWT IDs belong to other signing consumers with valid local keys; their owners handle retirement. This API does not edit their settings or keys.

## Verification

Real shared-check tests cover plaintext success, retired per-setting and bundle ciphertext rejection even with the legacy disabled flag, and unchanged inputs. Actual App.listen rejects ciphertext before listening. A scanner regression proves the retired flag cannot hide an import failure. The owned-local real SDK R2 journey now validates plaintext/rejects ciphertext before its write/read/delete checks. Removing the startup check or restoring the old flag makes the respective assertions fail. Existing real Valkey/native integration and coverage thresholds remain unchanged; all tests stay under the AWS/network guard.

Deploy through preview, preprod and mainnet using normal Actions. After each environment, repeat both-box installed-factory scratch PUT/GET byte comparison/DELETE/404 proof, with exact current image/Fn ID/tag IDs and SDK path/version recorded. Approved read-only filesystem copies (including the installed Node binary) avoid paused-container mutation. No independent replacement client, bridge import, worker warming, Docker unpause/run, AWS operation or financial call is authorized.
