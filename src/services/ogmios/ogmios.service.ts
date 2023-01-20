import { createInteractionContext, InteractionContext } from '@cardano-ogmios/client';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import { BlockTip, TxBlock } from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { writeConsoleLine } from '../../utils/util';
import { handleEraBoundaries, Point, POLICY_IDS } from './constants';
import { processBlock } from './processBlock';
import { memoryWatcher } from './utils';
import { createLocalChainSyncClient } from './utils/localChainSync';

let startOgmiosExec = 0;

class OgmiosService {
    public intervals: NodeJS.Timer[] = [];
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

        const { elapsedOgmiosExec } = HandleStore.getTimeMetrics();
        HandleStore.setMetrics({ elapsedOgmiosExec: elapsedOgmiosExec + ogmiosExecFinished });

        const policyId = POLICY_IDS[process.env.NETWORK ?? 'testnet'][0];
        await processBlock({ policyId, txBlock: response.block as TxBlock, tip: response.tip as BlockTip });

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
        // const metricsInterval = setInterval(() => {
        //     if (process.env.CONSOLE_STATUS === 'true') {
        //         const metrics = HandleStore.getMetrics();
        //         if (!metrics) return;

        //         const {
        //             percentageComplete,
        //             currentMemoryUsed,
        //             buildingElapsed,
        //             memorySize,
        //             handleCount,
        //             ogmiosElapsed,
        //             slotDate
        //         } = metrics;

        //         writeConsoleLine(
        //             this.startTime,
        //             `${percentageComplete}% Completed | ${currentMemoryUsed}MB Used | ${handleCount} Total Handles | ${memorySize} Object Size | ${ogmiosElapsed} Ogmios Elapsed | ${buildingElapsed} Building Elapsed | ${slotDate.toISOString()} Slot Date`
        //         );
        //     }
        // }, 1000);

        const saveFileInterval = setInterval(async () => {
            const { currentSlot, currentBlockHash } = HandleStore.getMetrics();
            await HandleStore.saveFile(currentSlot, currentBlockHash);

            memoryWatcher();
        }, 30000);

        const setMemoryInterval = setInterval(() => {
            const memorySize = HandleStore.memorySize();
            HandleStore.setMetrics({ memorySize });
        }, 60000);

        this.intervals = [saveFileInterval, setMemoryInterval];
    }

    public async getStartingPoint(): Promise<Point> {
        const initialStartingPoint = handleEraBoundaries[process.env.NETWORK ?? 'testnet'];
        const handlesContent = await HandleStore.prepareHandlesStorage();

        if (!handlesContent) {
            Logger.log('Handle storage not found');
            return initialStartingPoint;
        }

        const { slot, hash } = handlesContent;
        return { slot, hash };
    }

    public async startSync() {
        HandleStore.setMetrics({
            firstSlot: handleEraBoundaries[process.env.NETWORK ?? 'testnet'].slot,
            firstMemoryUsage: this.firstMemoryUsage
        });

        const context: InteractionContext = await createInteractionContext(
            (err) => console.error(err),
            () => {
                this.intervals.map((i) => clearInterval(i));
                Logger.log({
                    message: 'Connection closed.',
                    category: LogCategory.WARN,
                    event: 'OgmiosService.createInteractionContext.closeHandler'
                });
                process.exit(2);
            },
            { connection: { port: 1337 } }
        );

        const client = await createLocalChainSyncClient(context, {
            rollForward: this.rollForward,
            rollBackward: this.rollBackward
        });

        const startingPoint = await this.getStartingPoint();
        this.startIntervals();

        await client.startSync([startingPoint]);
    }
}

export default OgmiosService;
