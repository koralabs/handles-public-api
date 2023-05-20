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
};
