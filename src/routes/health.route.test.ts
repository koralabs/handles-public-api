import request from 'supertest';
import App from '../app';
import * as ogmiosUtils from '../services/ogmios/utils';
import { HttpException } from '../exceptions/HttpException';
import { IHandleStats } from '@koralabs/handles-public-api-interfaces';
import { HealthResponseBody } from '../interfaces/ogmios.interfaces';

jest.mock('../services/ogmios/ogmios.service');

let percentage: string = '';
const getStats = (): IHandleStats => ({
    percentage_complete: percentage,
    current_memory_used: 0,
    memory_size: 0,
    ogmios_elapsed: '',
    building_elapsed: '',
    slot_date: new Date(),
    handle_count: 0,
    current_slot: 0,
    current_block_hash: '',
    schema_version: 1
});

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
                const stats = getStats();
                return stats;
            },
            currentHttpStatus: () => {
                return 200;
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
                    building_elapsed: expect.any(String),
                    current_block_hash: expect.any(String),
                    current_memory_used: expect.any(Number),
                    current_slot: expect.any(Number),
                    memory_size: expect.any(Number),
                    handle_count: expect.any(Number),
                    ogmios_elapsed: expect.any(String),
                    percentage_complete: expect.any(String),
                    slot_date: expect.any(String),
                    schema_version: expect.any(Number)
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
                    building_elapsed: expect.any(String),
                    current_block_hash: expect.any(String),
                    current_memory_used: expect.any(Number),
                    current_slot: expect.any(Number),
                    memory_size: expect.any(Number),
                    handle_count: expect.any(Number),
                    ogmios_elapsed: expect.any(String),
                    percentage_complete: expect.any(String),
                    slot_date: expect.any(String),
                    schema_version: expect.any(Number)
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
                    building_elapsed: expect.any(String),
                    current_block_hash: expect.any(String),
                    current_memory_used: expect.any(Number),
                    current_slot: expect.any(Number),
                    memory_size: expect.any(Number),
                    handle_count: expect.any(Number),
                    ogmios_elapsed: expect.any(String),
                    percentage_complete: expect.any(String),
                    slot_date: expect.any(String),
                    schema_version: expect.any(Number)
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
                    building_elapsed: expect.any(String),
                    current_block_hash: expect.any(String),
                    current_memory_used: expect.any(Number),
                    current_slot: expect.any(Number),
                    memory_size: expect.any(Number),
                    handle_count: expect.any(Number),
                    ogmios_elapsed: expect.any(String),
                    percentage_complete: expect.any(String),
                    slot_date: expect.any(String),
                    schema_version: expect.any(Number)
                },
                status: 'current'
            });
        });
    });
});
