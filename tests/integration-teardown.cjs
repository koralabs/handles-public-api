'use strict';
require('./network-guard.cjs');
module.exports = async () => { require('./valkey-harness.cjs').stop(); };
