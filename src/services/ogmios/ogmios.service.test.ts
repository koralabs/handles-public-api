import * as ogmiosClient from '@cardano-ogmios/client';
import { HandleStore } from '../../repositories/memory/HandleStore';
import OgmiosService from './ogmios.service';

jest.mock('@cardano-ogmios/client');
jest.mock('../../repositories/memory/HandleStore');

describe('Ogmios Service Tests', () => {
    describe('OgmiosService.startSync', () => {
        it('Should call ogmios functions and start sync', async () => {
            // @ts-ignore;
            const createChainSyncClientSpy = jest.spyOn(ogmiosClient, 'createChainSyncClient').mockResolvedValue({
                // @ts-ignore;
                startSync: (result) => {
                    expect(result).toEqual([
                        {
                            slot: 42971872,
                            hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6'
                        }
                    ]);
                    return jest.fn();
                }
            });
            const createInteractionContextSpy = jest.spyOn(ogmiosClient, 'createInteractionContext');
            jest.spyOn(HandleStore, 'getFile');
            jest.spyOn(HandleStore, 'getMetrics').mockReturnValue({
                percentageComplete: '0',
                currentMemoryUsed: 0,
                memorySize: 0,
                buildingElapsed: '',
                ogmiosElapsed: '',
                slotDate: new Date(),
                currentSlot: 0,
                currentBlockHash: ''
            });
            const ogmiosService = new OgmiosService();
            await ogmiosService.startSync();

            expect(createChainSyncClientSpy).toHaveBeenCalledTimes(1);
            expect(createInteractionContextSpy).toHaveBeenCalledTimes(1);
        });
    });
});
