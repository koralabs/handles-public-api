import request from 'supertest';
import App from '../app';
import * as ogmiosUtils from '../services/ogmios/utils';
import { HttpException } from '../exceptions/HttpException';
import { IHandleStats } from '@koralabs/handles-public-api-interfaces';
import { HealthResponseBody } from '../interfaces/ogmios.interfaces';

jest.mock('../services/ogmios/ogmios.service');

let percentage: string = '';
const getStats = (): IHandleStats => ({
    percentageComplete: percentage,
    currentMemoryUsed: 0,
    memorySize: 0,
    ogmiosElapsed: '',
    buildingElapsed: '',
    slotDate: new Date(),
    handleCount: 0,
    currentSlot: 0,
    currentBlockHash: ''
});

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
                const stats = getStats();
                return stats;
            },
            getIsCaughtUp: () => {
                return true;
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
        percentage = '';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const getMockResponse = ({ lastTipUpdate = '' }: { lastTipUpdate?: string }): HealthResponseBody => ({
        startTime: '',
        lastKnownTip: {
            slot: 0,
            hash: '',
            blockNo: 0
        },
        lastTipUpdate,
        networkSynchronization: 0,
        currentEra: '',
        metrics: {
            activeConnections: 0,
            runtimeStats: {
                cpuTime: 0,
                currentHeapSize: 0,
                gcCpuTime: 0,
                maxHeapSize: 0
            },
            sessionDurations: {
                max: 0,
                mean: 0,
                min: 0
            },
            totalConnections: 0,
            totalMessages: 0,
            totalUnrouted: 0
        },
        connectionStatus: 'connected',
        currentEpoch: 0,
        slotInEpoch: 0
    });

    describe('[GET] /health', () => {
        it('Should return 202 and health stats even when ogmios does not connect', async () => {
            jest.spyOn(ogmiosUtils, 'fetchHealth').mockResolvedValue(null);
            const response = await request(app?.getServer()).get('/health');
            expect(response.status).toEqual(202);
            expect(response.body).toEqual({
                ogmios: null,
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

        it('Should return 202 when ogmios is not caught up', async () => {
            const ogmiosResult = getMockResponse({
                lastTipUpdate: `${new Date(Date.now() - 60000).toISOString()}`
            });
            jest.spyOn(ogmiosUtils, 'fetchHealth').mockResolvedValue(ogmiosResult);
            const response = await request(app?.getServer()).get('/health');
            expect(response.status).toEqual(202);
            expect(response.body).toEqual({
                ogmios: ogmiosResult,
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
                },
                status: 'ogmios_behind'
            });
        });

        it('Should return 202 when current slot is not caught up', async () => {
            const ogmiosResult = getMockResponse({
                lastTipUpdate: `${Date.now() + 60000}`
            });
            jest.spyOn(ogmiosUtils, 'fetchHealth').mockResolvedValue(ogmiosResult);
            const response = await request(app?.getServer()).get('/health');
            expect(response.status).toEqual(202);
            expect(response.body).toEqual({
                ogmios: ogmiosResult,
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
                },
                status: 'storage_behind'
            });
        });

        it('Should return 200 everything is caught up', async () => {
            const ogmiosResult = getMockResponse({
                lastTipUpdate: `${Date.now() + 60000}`
            });

            percentage = '100.00';
            jest.spyOn(ogmiosUtils, 'fetchHealth').mockResolvedValue(ogmiosResult);
            const response = await request(app?.getServer()).get('/health');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                ogmios: ogmiosResult,
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
                },
                status: 'current'
            });
        });
    });
});
