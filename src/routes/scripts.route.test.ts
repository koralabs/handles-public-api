import request from 'supertest';
import App from '../app';
import { scripts } from '../config/scripts';
import { ScriptDetails, ScriptType } from '@koralabs/kora-labs-common';

jest.mock('../services/ogmios/ogmios.service');

jest.mock('../ioc', () => ({
    registry: {
        ['handlesRepo']: jest.fn().mockReturnValue({
            getHandleByName: (handleName: string) => {
                return {
                    name: handleName,
                    utxo: 'utxo#0',
                    resolved_addresses: {
                        ada: 'addr1'
                    },
                    personalization: {
                        p: 'z'
                    },
                    datum: 'a247'
                };
            },
            currentHttpStatus: () => 200
        }),
        ['apiKeysRepo']: jest.fn().mockReturnValue({
            get: (key: string) => key === 'valid-key'
        })
    }
}));

afterAll(async () => {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));
});

describe('Scripts Routes Test', () => {
    let app: App | null;
    beforeEach(() => {
        app = new App();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('[GET] /scripts', () => {
        it('Should only find 1 latest script for each type and network', async () => {
            const mainnet = scripts.mainnet;
            const preprod = scripts.preprod;
            const preview = scripts.preview;

            expect(Object.values(mainnet).filter((script) => script.latest && script.type === ScriptType.PZ_CONTRACT).length).toEqual(1);
            expect(Object.values(preprod).filter((script) => script.latest && script.type === ScriptType.PZ_CONTRACT).length).toEqual(1);
            expect(Object.values(preview).filter((script) => script.latest && script.type === ScriptType.PZ_CONTRACT).length).toEqual(1);
            // types
            // expect(Object.values(mainnet).filter((script) => script.latest && script.type === ScriptType.SUB_HANDLE_SETTINGS).length).toEqual(1);
            // expect(Object.values(preprod).filter((script) => script.latest && script.type === ScriptType.SUB_HANDLE_SETTINGS).length).toEqual(1);
            expect(Object.values(preview).filter((script) => script.latest && script.type === ScriptType.SUB_HANDLE_SETTINGS).length).toEqual(1);
        });

        it('Should return scripts data', async () => {
            const response = await request(app?.getServer()).get('/scripts');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual(scripts[process.env.NETWORK ?? 'preview']);
        });

        it('Should return latest pz_contract script with only latest param', async () => {
            const network = process.env.NETWORK ?? 'preview';
            const [key, latestScript] = Object.entries(scripts[network]).find(([_, value]) => value.latest && value.type === ScriptType.PZ_CONTRACT) as [string, ScriptDetails];
            delete latestScript.cbor;
            delete latestScript.refScriptAddress;
            delete latestScript.refScriptUtxo;

            const response = await request(app?.getServer()).get('/scripts?latest=true');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                ...latestScript,
                scriptAddress: key
            });
        });

        it('Should return latest sub_handle_settings script', async () => {
            const network = process.env.NETWORK ?? 'preview';
            const [key, latestScript] = Object.entries(scripts[network]).find(([_, value]) => value.latest && value.type === ScriptType.SUB_HANDLE_SETTINGS) as [string, ScriptDetails];
            delete latestScript.cbor;
            delete latestScript.refScriptAddress;
            delete latestScript.refScriptUtxo;

            const response = await request(app?.getServer()).get(`/scripts?latest=true&type=${ScriptType.SUB_HANDLE_SETTINGS}`);
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                ...latestScript,
                scriptAddress: key
            });
        });
    });
});
