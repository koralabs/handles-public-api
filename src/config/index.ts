import { config } from 'dotenv';
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const isDatumEndpointEnabled = () => process.env.ENABLE_DATUM_ENDPOINT === 'true';
export const {
    NODE_ENV = '',
    PORT = '',
    SECRET_KEY = '',
    LOG_FORMAT = '',
    LOG_DIR = '',
    ORIGIN = '',
    OGMIOS_HOST = 'http://localhost:1337',
    NETWORK = '',
    DISABLE_HANDLES_SNAPSHOT = '',
    IPFS_GATEWAY = 'https://ipfs.io/ipfs/'
} = process.env;
