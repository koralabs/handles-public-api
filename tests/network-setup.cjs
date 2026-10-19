'use strict';
require('./network-guard.cjs');
Object.assign(process.env, {
    KORA_OBJECT_STORE: 'r2',
    R2_ENDPOINT: 'http://r2-test.invalid',
    R2_ACCESS_KEY_ID: 'test-only-access',
    R2_SECRET_ACCESS_KEY: 'test-only-secret',
    SNAPSHOT_BASE_URL: 'http://snapshot-test.invalid'
});
module.exports = async () => {};
