import { LogCategory, Logger, REDIS_HOST } from '@koralabs/kora-labs-common';
import { GlideClient } from '@valkey/valkey-glide';
import { parentPort, workerData } from 'node:worker_threads';

let glideClient;

async function getClient() {
  if (!glideClient) {
    glideClient = await GlideClient.createClient({
      addresses: [{ host: REDIS_HOST }],
      // if the server uses TLS, you'll need to enable it. Otherwise, the connection attempt will time out silently.
      useTLS: process.env.REDIS_USE_TLS == 'true'
    });
    const status = await glideClient.ping();
    if (status == "PONG") {
      Logger.log("Connected to Valkey");
    }
  }
  return glideClient;
}

parentPort.on('message', async (m) => {
  const { id, sab, payload } = m;
  const view = new Int32Array(sab);
  try {
    const client = await getClient();
    const result = await client[payload.cmd](...payload.args)
    //logKeyRequest('handle:', payload); // What is getting passed in?
    workerData.port.postMessage({ id, ok: true, result });
    //logKeyResult('handle:', payload, result) // What is the result from Valkey?
  } catch (e) {
    Logger.log({message: JSON.stringify(e), category: LogCategory.ERROR, event: "redisSync.worker.error"})
    workerData.port.postMessage({ id, ok: false, error: { message: String(e?.message ?? e), stack: e?.stack } });
  } finally {
    Atomics.store(view, 0, 1);
    Atomics.notify(view, 0, 1);
  }
});

function logKeyRequest(key, payload) {
  if (payload.args && payload.args.length > 0 && typeof payload.args[0] == string && payload.args[0].startsWith(key)) {
    console.log(`Valkey request for ${payload.args[0]}`, payload);
  }
}

function logKeyResult(key, payload, result) {
  if (payload.args && payload.args.length > 0 && typeof payload.args[0] == string && payload.args[0].startsWith(key)) {
    console.log(`Valkey result for ${payload.args[0]}`, result);
  }
}