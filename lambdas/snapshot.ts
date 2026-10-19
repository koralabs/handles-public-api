import { validatePlaintextStartup } from '../utils/startupEnvironment';
import { handler as snapshotHandler, processSnapshot as runSnapshot } from './snapshot.app';

// Non-handler exports let operator verification use the installed client's exact configuration.
export { createSnapshotObjectStoreClient, SNAPSHOT_BUCKET, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from './snapshot.app';

export const processSnapshot = async (network: string) => {
    await validatePlaintextStartup();
    return runSnapshot(network);
};

export const handler = async (event: any) => {
    await validatePlaintextStartup();
    return snapshotHandler(event);
};
