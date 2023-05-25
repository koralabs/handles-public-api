import { IHandleStats } from '@koralabs/handles-public-api-interfaces';
import request from 'supertest';
import App from '../app';
import { HttpException } from '../exceptions/HttpException';

jest.mock('../services/ogmios/ogmios.service');

jest.mock('../ioc', () => ({
    registry: {
        ['handlesRepo']: jest.fn().mockReturnValue({
            getHandleByName: (handleName: string) => {
                if (['nope'].includes(handleName)) return null;

                return {
                    handle: handleName
                };
            },
            getAll: () => {
                return [
                    {
                        handle: 'burritos'
                    }
                ];
            },
            getAllHandleNames: () => {
                return ['burritos', 'tacos', 'barbacoa'];
            },
            getHandleStats: () => {
                const stats: IHandleStats = {
                    percentage_complete: '',
                    current_memory_used: 0,
                    memory_size: 0,
                    ogmios_elapsed: '',
                    building_elapsed: '',
                    slot_date: new Date(),
                    handle_count: 0,
                    current_slot: 0,
                    current_block_hash: ''
                };
                return stats;
            }
        }),
        ['apiKeysRepo']: jest.fn().mockReturnValue({
            get: (key: string) => key === 'valid-key'
        })
    }
}));

afterAll(async () => {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));
});

describe('Datum Routes Test', () => {
    let app: App | null;
    beforeEach(() => {
        app = new App();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('[POST] /datum', () => {
        const bg = {
            constructor_0: [
                {
                    'policy:id': {
                        constructor_0: [
                            {
                                '-': {
                                    constructor_0: [{ '-': 0 }]
                                }
                            }
                        ]
                    }
                }
            ]
        };

        it('Should return 200 and hex encoded CBOR', async () => {
            const response = await request(app?.getServer())
                .post('/datum?from=json&to=plutus_data_cbor')
                .set('Content-Type', 'application/json')
                .send(bg);
            expect(response.status).toEqual(200);
            expect(response.text).toEqual('d87981a149706f6c6963793a6964d87981a1412dd87981a1412d00');
        });

        it('Should return 200 and CBOR decoded JSON', async () => {
            const response = await request(app?.getServer())
                .post('/datum?from=plutus_data_cbor&to=json')
                .set('Content-Type', 'text/plain')
                .send('d87981a169706f6c6963793a6964d87981a1612dd87981a1612d00');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                constructor_0: [{ 'policy:id': { constructor_0: [{ '-': { constructor_0: [{ '-': 0 }] } }] } }]
            });
        });
    });
});
