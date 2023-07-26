import request from 'supertest';
import App from '../app';
import { scripts } from '../config/scripts';

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
            getIsCaughtUp: () => true
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
        it('Should return scripts data', async () => {
            const response = await request(app?.getServer()).get('/scripts');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual(scripts[process.env.NETWORK ?? 'preview']);
        });

        it('Should return latest script', async () => {
            const response = await request(app?.getServer()).get('/scripts?latest=true');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual(
                expect.objectContaining({
                    scriptAddress: expect.any(String),
                    validatorHash: expect.any(String),
                    cbor: expect.any(String),
                    handle: expect.any(String),
                    hex: expect.any(String),
                    latest: expect.any(Boolean),
                    output: expect.objectContaining({
                        utxo: expect.any(String),
                        address: expect.any(String)
                    })
                })
            );
        });
    });
});
