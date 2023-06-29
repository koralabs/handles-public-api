const fs = require('fs');
const lockfile = require('proper-lockfile');
const { parentPort, workerData } = require('worker_threads');

(async () => {
    try {
        const isLocked = await lockfile.check(workerData.storagePath);
        if (isLocked) {
            return false;
        }

        const release = await lockfile.lock(workerData.storagePath, {retries: {
            retries: 5,
            minTimeout: 2 * 1000,
            maxTimeout: 20 * 1000,
            randomize: true,
        }});

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
    } catch (error) {
        Logger.log({
            message: `Error writing file: ${error.message}`,
            event: 'saveFileContents.errorSavingFile',
            category: LogCategory.INFO 
        });
    }
    parentPort?.postMessage(true);
})()