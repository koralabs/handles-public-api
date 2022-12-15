import * as ogmiosClient from '@cardano-ogmios/client';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { handleEraBoundaries } from './constants';
import OgmiosService from './ogmios.service';
import * as localChainSync from './utils/localChainSync';

jest.mock('@cardano-ogmios/client');
jest.mock('./utils/localChainSync');
jest.mock('../../repositories/memory/HandleStore');

describe('OgmiosService Tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('startSync', () => {
        it('Should call ogmios functions and start sync', async () => {
            // @ts-ignore;
            const createChainSyncClientSpy = jest
                .spyOn(localChainSync, 'createLocalChainSyncClient')
                .mockResolvedValue({
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
            jest.spyOn(HandleStore, 'getFileOnline');
            jest.spyOn(HandleStore, 'getMetrics').mockReturnValue({
                percentageComplete: '0',
                currentMemoryUsed: 0,
                memorySize: 0,
                buildingElapsed: '',
                ogmiosElapsed: '',
                slotDate: new Date(),
                handleCount: 0,
                currentSlot: 0,
                currentBlockHash: ''
            });
            const ogmiosService = new OgmiosService();
            await ogmiosService.startSync();

            ogmiosService.intervals.map((i) => clearInterval(i));

            expect(createChainSyncClientSpy).toHaveBeenCalledTimes(1);
            expect(createInteractionContextSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('getStartingPoint', () => {
        it('Should use starting point from constants if both no data is found from files', async () => {
            jest.spyOn(HandleStore, 'prepareHandlesStorage').mockResolvedValue(null);
            const ogmiosService = new OgmiosService();
            const startingPoint = await ogmiosService.getStartingPoint();
            expect(startingPoint).toEqual(handleEraBoundaries['testnet']);
        });

        it('Should use starting point from prepareHandlesStorage', async () => {
            jest.spyOn(HandleStore, 'prepareHandlesStorage').mockResolvedValue({
                slot: 2,
                hash: 'b',
                handles: {}
            });
            const ogmiosService = new OgmiosService();
            const startingPoint = await ogmiosService.getStartingPoint();
            expect(startingPoint).toEqual({
                slot: 2,
                hash: 'b'
            });
        });
    });
});
