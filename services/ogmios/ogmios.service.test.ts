import * as ogmiosClient from '@cardano-ogmios/client';
import { HandlesRepository } from '../../repositories/handlesRepository';
import { MemoryHandlesProvider } from '../../repositories/memory';
import OgmiosService from './ogmios.service';

jest.mock('@cardano-ogmios/client');
jest.mock('../../repositories/memory/handleStore');
jest.mock('../../repositories/memory');
const handlesRepo = new MemoryHandlesProvider();
const ogmios = new OgmiosService(new HandlesRepository(handlesRepo));
//(someInstance as unknown) as { privateMethod: SomeClass['privateMethod'] }

describe('OgmiosService Tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('startSync', () => {
        it('Should call ogmios functions and start sync', async () => {
            const mockedOgmios = ogmios as unknown as { client: { resume: () => {}, shutdown: () => {} }; createLocalChainSyncClient: OgmiosService['createLocalChainSyncClient'] } as any;
            const createChainSyncClientSpy = jest.spyOn(mockedOgmios, 'createLocalChainSyncClient').mockResolvedValue({
                resume: (result: any) => {
                    expect(result).toEqual(['origin']);
                    return jest.fn();
                },
                shutdown: () => {}
            });
            const createInteractionContextSpy = jest.spyOn(ogmiosClient, 'createInteractionContext');
            jest.spyOn(MemoryHandlesProvider.prototype, 'getMetrics').mockReturnValue({
                firstMemoryUsage: 0,
                memorySize: 0,
                elapsedBuildingExec: 0,
                elapsedOgmiosExec: 0,
                count: 0,
                currentSlot: 0,
                currentBlockHash: '',
                schemaVersion: 0
            });
            await mockedOgmios.initialize();
            await mockedOgmios.startSync({ slot: 0 });

            expect(createChainSyncClientSpy).toHaveBeenCalledTimes(1);
            expect(createInteractionContextSpy).toHaveBeenCalledTimes(1);
        });
    });
});
