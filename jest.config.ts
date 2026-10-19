import './tests/network-guard.cjs';
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

process.env.API_TEST_MODE = 'unit';
process.env.NODE_ENV = 'test';
process.env.IS_LOCAL = 'true';
// Tests intercept fetch so this value is never sent to a real API.
//jest.spyOn(global.console, 'log').mockImplementation(() => jest.fn());

const config = {
    'preset': 'ts-jest/presets/default-esm',
    'testEnvironment': 'node',
    'globalSetup': './tests/network-setup.cjs',
    'setupFiles': ['./tests/network-guard.cjs'],
    'silent': true,
    'testPathIgnorePatterns': ['\\.e2e\\.test\\.ts$']

}
export default config
