import { Logger, REDIS_HOST } from '@koralabs/kora-labs-common';
import { Batch, GlideClient } from '@valkey/valkey-glide';
import { parentPort, workerData } from 'node:worker_threads';

let glideClient;

async function getClient() {
  if (!glideClient) {
    glideClient = (await GlideClient.createClient({
      addresses: [{ host: REDIS_HOST, port: 6379 }],
      // if the server uses TLS, you'll need to enable it. Otherwise, the connection attempt will time out silently.
      useTLS: process.env.REDIS_USE_TLS ? process.env.REDIS_USE_TLS == 'true' : true
    }));
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
    //logKeyRequest('handle:', payload); // What is getting passed in?
    const client = await getClient();
    //console.log('COMMAND', payload.cmd)
    if (payload.cmd == 'batch') {
      const pipeline = new Batch(true);
      //console.log('PAYLOAD.ARGS', payload.args)
      for (const [cmd, args] of payload.args[0]) {
        //console.log(cmd, args)
        pipeline[cmd](...args)
      }
      const result = await client.exec(pipeline, true, {timeout: 10_000})
      //console.log(result)
      workerData.port.postMessage({ id, ok: true, result });
    }
    else {
      const result = await client[payload.cmd](...payload.args)
      workerData.port.postMessage({ id, ok: true, result });
    }
    //logKeyResult('handle:', payload, result) // What is the result from Valkey?
  } catch (e) {
    const message = `ERROR WITH PAYLOAD: ${JSON.stringify(payload)} | ERROR: ${JSON.stringify(e)} | STACK: ${e?.stack}`;
    workerData.port.postMessage({ id, ok: false, error: { message, stack: e?.stack } });
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