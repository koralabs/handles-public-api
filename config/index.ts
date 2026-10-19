export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const isDatumEndpointEnabled = () => process.env.ENABLE_DATUM_ENDPOINT === 'true';
export const {
    NODE_ENV = '',
    PORT = '',
    SECRET_KEY = '',
    LOG_FORMAT = '',
    LOG_DIR = '',
    ORIGIN = process.env.CORS_ORIGIN || '',
    OGMIOS_HOST = 'http://localhost:1337',
    NETWORK = '',
    DISABLE_HANDLES_SNAPSHOT = '',
    SNAPSHOT_BASE_URL = '',
    WHITELISTED_API_KEYS = ''
} = process.env;

export const getSnapshotUrl = (network: string, schemaVersion: number) => {
    const baseUrl = SNAPSHOT_BASE_URL.trim().replace(/\/+$/, '');
    if (!baseUrl) throw new Error('SNAPSHOT_BASE_URL must be set to the R2 snapshot public URL');
    return `${baseUrl}/${network}/utxo-snapshot/${schemaVersion}/handles_utxos.gz`;
};

export const getIpfsGateway = (backup = false) => {
    return backup
        ? process.env.IPFS_GATEWAY_BACKUP || 'https://ipfs.io/ipfs/'
        : process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
};