import { mapStringifyReplacer } from '@koralabs/kora-labs-common';
import fs from 'fs';
import * as lockfile from 'proper-lockfile';
import { parentPort, workerData } from 'worker_threads';

(async () => {
    const isLocked = await lockfile.check(workerData.storagePath);
    if (isLocked) {
        return false;
    }

    const release = await lockfile.lock(workerData.storagePath, {retries: {
        retries: 5,
        minTimeout: 2 * 1000,
        maxTimeout: 20 * 1000,
        randomize: true
    }});

    // if there is no content, hash or slot we can assume we are going to clear the file
    const fileContent =
            workerData.content && workerData.hash && workerData.slot
                ? JSON.stringify({
                    slot: workerData.slot,
                    hash: workerData.hash,
                    schemaVersion: workerData.storageSchemaVersion,
                    ...workerData.content
                }, mapStringifyReplacer)
                : '';

    fs.writeFileSync(workerData.storagePath, fileContent);

    if (workerData.testDelay) {
        await Promise((resolve) => setTimeout(resolve, 1000));
    }
    await release();
    parentPort?.postMessage(true);
})()