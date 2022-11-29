import request from 'supertest';
import HealthRoutes from './health.route';
import App from '../app';
import * as ogmiosUtils from '../services/ogmios/utils';
import { HttpException } from '../exceptions/HttpException';
import { IHandleStats } from '@koralabs/handles-public-api-interfaces';

jest.mock('../services/ogmios/ogmios.service');

jest.mock('../ioc', () => ({
    registry: {
        ['handlesRepo']: jest.fn().mockReturnValue({
            getHandleByName: (handleName: string) => {
                if (handleName === 'nope') {
                    throw new HttpException(404, 'Not found');
                }

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
                    percentageComplete: '',
                    currentMemoryUsed: 0,
                    memorySize: 0,
                    ogmiosElapsed: '',
                    buildingElapsed: '',
                    slotDate: new Date(),
                    handleCount: 0,
                    currentSlot: 0,
                    currentBlockHash: ''
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

describe('Health Routes Test', () => {
    let app: App | null;
    beforeEach(() => {
        app = new App();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('[GET] /health', () => {
        it('Should return 200 and health stats', async () => {
            // @ts-ignore
            jest.spyOn(ogmiosUtils, 'fetchHealth').mockResolvedValue({ stats: 'burritos' });
            const response = await request(app?.getServer()).get('/health');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                ogmios: { stats: 'burritos' },
                stats: {
                    buildingElapsed: expect.any(String),
                    currentBlockHash: expect.any(String),
                    currentMemoryUsed: expect.any(Number),
                    currentSlot: expect.any(Number),
                    memorySize: expect.any(Number),
                    handleCount: expect.any(Number),
                    ogmiosElapsed: expect.any(String),
                    percentageComplete: expect.any(String),
                    slotDate: expect.any(String)
                }
            });
        });
    });
});
