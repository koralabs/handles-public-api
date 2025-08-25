import dotenv from "dotenv";
dotenv.config({ path: ".env" });

process.env.NODE_ENV = 'test';

const config = {
    'preset': 'ts-jest/presets/default-esm',
    'testEnvironment': 'node',
    'globalTeardown': './repositories/tests/globalTeardown.ts',
}
export default config