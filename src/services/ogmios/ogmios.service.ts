import { createChainSyncClient, createInteractionContext, InteractionContext } from '@cardano-ogmios/client';
import { BlockTip, TxBlock } from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { Logger } from '../../utils/logger';
import { writeConsoleLine } from '../../utils/util';
import { handleEraBoundaries, Point, POLICY_IDS } from './constants';
import { processBlock } from './processBlock';

let startOgmiosExec = 0;

class OgmiosService {
    private intervals: NodeJS.Timer[] = [];
    private startTime: number;
    private firstMemoryUsage: number;

    constructor() {
        this.startTime = Date.now();
        this.firstMemoryUsage = process.memoryUsage().rss;
    }

    private async rollForward(
        response: {
            block: unknown;
            tip: unknown;
        },
        requestNext: () => void
    ) {
        // finish timer for ogmios rollForward
        const ogmiosExecFinished = startOgmiosExec === 0 ? 0 : Date.now() - startOgmiosExec;

        const { elapsedOgmiosExec } = HandleStore.getTimeMetrics()
        HandleStore.setMetrics({ elapsedOgmiosExec: elapsedOgmiosExec + ogmiosExecFinished  });

        const policyId = POLICY_IDS[process.env.NETWORK ?? 'testnet'][0];
        processBlock({ policyId, txBlock: response.block as TxBlock, tip: response.tip as BlockTip });

        // start timer for ogmios rollForward
        startOgmiosExec = Date.now();
        requestNext();
    }

    private async rollBackward(response: { point: unknown }, requestNext: () => void): Promise<void> {
        // TODO: Figure out how to Handle rollbacks!
        Logger.log(`ROLLBACK POINT: ${JSON.stringify(response.point)}`);
        requestNext();
    }

    private startIntervals() {
        const metricsInterval = setInterval(() => {
            const { percentageComplete, currentMemoryUsed, memorySize, buildingElapsed, ogmiosElapsed, slotDate } =
                HandleStore.getMetrics();

            writeConsoleLine(
                this.startTime,
                `${percentageComplete}% Completed | ${currentMemoryUsed}MB Used | ${HandleStore.count()} Total Handles | ${memorySize} Object Size | ${ogmiosElapsed} Ogmios Elapsed | ${buildingElapsed} Building Elapsed | ${slotDate.toISOString()} Slot Date`
            );
        }, 1000);

        const saveFileInterval = setInterval(() => {
            const { currentSlot, currentBlockHash } =
                HandleStore.getMetrics();
            HandleStore.saveFile(currentSlot, currentBlockHash);
        }, 30000);

        this.intervals = [metricsInterval, saveFileInterval];
    }

    private getStartingPoint(): Point {
        const existingHandles = HandleStore.getFile();
        let startingPoint = handleEraBoundaries[process.env.NETWORK ?? 'testnet'];
        if (existingHandles) {
            const { slot, hash, handles } = JSON.parse(existingHandles);

            Object.keys(handles ?? {}).forEach((k) => {
                const handle = handles[k];
                HandleStore.save(handle.hex, handle);
            });
            Logger.log(
                `Handle storage found at slot: ${slot} and hash: ${hash} with ${
                    Object.keys(handles ?? {}).length
                } handles`
            );
            startingPoint = { slot, hash };
        } else {
            Logger.log('Handle storage not found');
        }

        return startingPoint;
    }

    public async startSync() {
        HandleStore.setMetrics({ 
            firstSlot: handleEraBoundaries[process.env.NETWORK ?? 'testnet'].slot,
            firstMemoryUsage: this.firstMemoryUsage
         })

        const context: InteractionContext = await createInteractionContext(
            (err) => console.error(err),
            () => {
                this.intervals.map(i => clearInterval(i))
                Logger.log('Connection closed.')
            },
            { connection: { port: 1337 } }
        );

        const client = await createChainSyncClient(context, {
            rollForward: this.rollForward,
            rollBackward: this.rollBackward
        });

        this.startIntervals();
        const startingPoint = this.getStartingPoint();

        await client.startSync([startingPoint]);
    }
}

export default OgmiosService;
