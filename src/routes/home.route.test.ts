import request from 'supertest';
import App from '../app';
import { HttpException } from '../exceptions/HttpException';
import { IHandleStats } from '../interfaces/handle.interface';

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

describe('Home Routes Test', () => {
    let app: App | null;
    beforeEach(() => {
        app = new App();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('[GET] /home', () => {
        it('Should return 200', async () => {
            const response = await request(app?.getServer()).get('/');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({});
        });
    });
});
