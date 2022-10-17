import { config } from 'dotenv';
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const {
    NODE_ENV = '',
    PORT = '',
    SECRET_KEY = '',
    LOG_FORMAT = '',
    LOG_DIR = '',
    ORIGIN = '',
    MY_AWS_ACCESS_KEY = '',
    MY_AWS_SECRET_ACCESS_KEY = '',
    MY_AWS_BUCKET = '',
    MY_AWS_FIREBASE_KEY = '',
    OGMIOS_ENDPOINT = 'http://localhost:1337'
} = process.env;
