import { HttpException } from '../../exceptions/HttpException';
import { IHandleStats } from '../../interfaces/handle.interface';

export const setupRegistryMocks = () => {
    jest.mock('../../ioc', () => ({
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
};
