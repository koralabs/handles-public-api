import * as ogmiosClient from '@cardano-ogmios/client';
import { handlesFixture } from '../../repositories/memory/fixtures/handles';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { handleEraBoundaries } from './constants';
import OgmiosService from './ogmios.service';

jest.mock('@cardano-ogmios/client');
jest.mock('../../repositories/memory/HandleStore');

describe('OgmiosService Tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('startSync', () => {
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
            jest.spyOn(HandleStore, 'getFileFromAWS');
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
        it('Should get starting point from AWS file because it is newer', async () => {
            const saveSpy = jest.spyOn(HandleStore, 'save');
            const saveFileSpy = jest.spyOn(HandleStore, 'saveFile');
            jest.spyOn(HandleStore, 'getFileFromAWS').mockResolvedValue({
                slot: 75171663,
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                handles: {
                    handle1: handlesFixture[0],
                    handle2: handlesFixture[1]
                },
                schemaVersion: 1
            });
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
                slot: 42971872,
                hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
                handles: {},
                schemaVersion: 1
            });

            const ogmiosService = new OgmiosService();
            const startingPoint = await ogmiosService.getStartingPoint();

            expect(startingPoint).toEqual({
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                slot: 75171663
            });

            expect(saveSpy).toHaveBeenCalledTimes(2);
            expect(saveFileSpy).toHaveBeenCalledWith(
                75171663,
                'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368'
            );
        });

        it('Should get starting point from the local file because it is newer', async () => {
            jest.spyOn(HandleStore, 'getFileFromAWS').mockResolvedValue({
                slot: 42971872,
                hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
                handles: {},
                schemaVersion: 1
            });
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
                slot: 75171663,
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                handles: {},
                schemaVersion: 1
            });
            const ogmiosService = new OgmiosService();
            const startingPoint = await ogmiosService.getStartingPoint();
            expect(startingPoint).toEqual({
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                slot: 75171663
            });
        });

        it('Should get starting point from the AWS file because the schema is newer', async () => {
            jest.spyOn(HandleStore, 'getFileFromAWS').mockResolvedValue({
                slot: 42971872,
                hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
                handles: {},
                schemaVersion: 2
            });
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
                slot: 75171663,
                hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
                handles: {},
                schemaVersion: 1
            });
            const ogmiosService = new OgmiosService();
            const startingPoint = await ogmiosService.getStartingPoint();
            expect(startingPoint).toEqual({
                hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
                slot: 42971872
            });
        });

        it('Should use starting point from constants if both AWS and local file are not found', async () => {
            const saveSpy = jest.spyOn(HandleStore, 'save');
            const saveFileSpy = jest.spyOn(HandleStore, 'saveFile');
            jest.spyOn(HandleStore, 'getFileFromAWS').mockResolvedValue(null);
            jest.spyOn(HandleStore, 'getFile').mockResolvedValue(null);
            const ogmiosService = new OgmiosService();
            const startingPoint = await ogmiosService.getStartingPoint();
            expect(startingPoint).toEqual(handleEraBoundaries['testnet']);
            expect(saveSpy).toHaveBeenCalledTimes(0);
            expect(saveFileSpy).toHaveBeenCalledTimes(0);
        });
    });
});
