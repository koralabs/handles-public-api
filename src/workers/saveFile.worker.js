const fs = require('fs');
const lockfile = require('proper-lockfile');
const { parentPort, workerData } = require('worker_threads');

(async () => {
    const isLocked = await lockfile.check(workerData.storagePath);
    if (isLocked) {
        return false;
    }

    const release = await lockfile.lock(workerData.storagePath);

    // if there is no content, hash or slot we can assume we are going to clear the file
    const fileContent =
        workerData.content && workerData.hash && workerData.slot
            ? JSON.stringify({
                slot: workerData.slot,
                hash: workerData.hash,
                schemaVersion: workerData.storageSchemaVersion,
                ...workerData.content
            })
            : '';

    fs.writeFileSync(workerData.storagePath, fileContent);

    if (workerData.testDelay) {
        await Promise((resolve) => setTimeout(resolve, 1000));
    }
    await release();
    parentPort?.postMessage(true);
})()