import * as ogmiosClient from '@cardano-ogmios/client';
import { IHandlesRepository } from '@koralabs/kora-labs-common';
import { MemoryHandlesRepository } from '../../repositories/memory/handles.repository';
import { HandleStore } from '../../repositories/memory/HandleStore';
import OgmiosService from './ogmios.service';

jest.mock('@cardano-ogmios/client');
jest.mock('../../repositories/memory/HandleStore');
jest.mock('../../repositories/memory/handles.repository');
const handlesRepo = MemoryHandlesRepository as unknown as IHandlesRepository;
const ogmios = new OgmiosService(handlesRepo);
//(someInstance as unknown) as { privateMethod: SomeClass['privateMethod'] }

describe('OgmiosService Tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('startSync', () => {
        it('Should call ogmios functions and start sync', async () => {
            const mockedOgmios = ogmios as unknown as { client: { resume: () => {} }; createLocalChainSyncClient: OgmiosService['createLocalChainSyncClient'] } as any;
            const createChainSyncClientSpy = jest.spyOn(mockedOgmios, 'createLocalChainSyncClient').mockResolvedValue({
                resume: (result: any) => {
                    expect(result).toEqual(['origin']);
                    return jest.fn();
                }
            });
            const createInteractionContextSpy = jest.spyOn(ogmiosClient, 'createInteractionContext');
            jest.spyOn(HandleStore, 'getFile');
            jest.spyOn(HandleStore, 'getFileOnline');
            jest.spyOn(HandleStore, 'getMetrics').mockReturnValue({
                percentage_complete: '0',
                current_memory_used: 0,
                memory_size: 0,
                building_elapsed: '',
                ogmios_elapsed: '',
                slot_date: new Date(),
                handle_count: 0,
                current_slot: 0,
                current_block_hash: '',
                schema_version: 0
            });
            await mockedOgmios.initialize();
            await mockedOgmios.startSync({ slot: 0 });

            expect(createChainSyncClientSpy).toHaveBeenCalledTimes(1);
            expect(createInteractionContextSpy).toHaveBeenCalledTimes(1);
        });
    });
});
