import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import { GlideClient } from '@valkey/valkey-glide';
import { parentPort, workerData } from 'node:worker_threads';

let glideClient;

async function getClient() {
  if (!glideClient) {
    glideClient = await GlideClient.createClient({
      addresses: [{ host: process.env.REDIS_HOST ?? '127.0.0.1' }],
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
    if (payload.args && payload.args.length > 0 && payload.args[0].startsWith('handle:')) {
      console.log('HANDLE Valkey command', payload);
    }
    const result = await client[payload.cmd](...payload.args)
    if (payload.args && payload.args.length > 0 && payload.args[0].startsWith('handle:')) {
      console.log('HANDLE Valkey result', result);
    }
    workerData.port.postMessage({ id, ok: true, result });
  } catch (e) {
    Logger.log({message: JSON.stringify(e), category: LogCategory.ERROR, event: "redisSync.worker.error"})
    workerData.port.postMessage({ id, ok: false, error: { message: String(e?.message ?? e), stack: e?.stack } });
  } finally {
    Atomics.store(view, 0, 1);
    Atomics.notify(view, 0, 1);
  }
});
