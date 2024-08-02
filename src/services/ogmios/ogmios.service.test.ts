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
            const createChainSyncClientSpy = jest.spyOn(localChainSync, 'createLocalChainSyncClient').mockResolvedValue({
                // @ts-ignore;
                resume: (result) => {
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
            expect(startingPoint).toEqual(handleEraBoundaries['preview']);
        });

        it('Should use starting point from prepareHandlesStorage', async () => {
            jest.spyOn(HandleStore, 'prepareHandlesStorage').mockResolvedValue({
                slot: 2,
                hash: 'b'
            });
            const ogmiosService = new OgmiosService();
            const startingPoint = await ogmiosService.getStartingPoint();
            expect(startingPoint).toEqual({
                slot: 2,
                id: 'b'
            });
        });
    });
});
