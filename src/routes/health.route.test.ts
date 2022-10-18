import request from 'supertest';
import HealthRoutes from './health.route';
import App from '../app';
import { setupRegistryMocks } from '../utils/tests/ioc.mock';
import * as ogmiosUtils from '../services/ogmios/utils';

jest.mock('../services/ogmios/ogmios.service');

setupRegistryMocks();

afterAll(async () => {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));
});

describe('Health Routes Test', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('[GET] /health', () => {
        it('Should return 200 and health stats', async () => {
            // @ts-ignore
            jest.spyOn(ogmiosUtils, 'fetchHealth').mockResolvedValue({ stats: 'burritos' });
            const healthRoutes = new HealthRoutes();
            const app = new App([healthRoutes]);

            const response = await request(app.getServer()).get('/health');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                ogmios: { stats: 'burritos' },
                stats: {
                    buildingElapsed: expect.any(String),
                    currentBlockHash: expect.any(String),
                    currentMemoryUsed: expect.any(Number),
                    currentSlot: expect.any(Number),
                    memorySize: expect.any(Number),
                    ogmiosElapsed: expect.any(String),
                    percentageComplete: expect.any(String),
                    slotDate: expect.any(String)
                }
            });
        });
    });
});
