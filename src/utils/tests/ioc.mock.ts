import { IHandleStats } from '@koralabs/handles-public-api-interfaces';
import { HttpException } from '../../exceptions/HttpException';

export const setupRegistryMocks = () => {
    jest.mock('../../ioc', () => ({
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
