import { createInteractionContext, InteractionContext } from '@cardano-ogmios/client';
import { PointOrOrigin, TipOrOrigin } from '@cardano-ogmios/schema';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import { BlockTip, TxBlock } from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { handleEraBoundaries, Point, POLICY_IDS } from './constants';
import { processBlock } from './processBlock';
import { processRollback } from './processRollback';
import { memoryWatcher } from './utils';
import { createLocalChainSyncClient } from './utils/localChainSync';
import { OGMIOS_HOST } from '../../config';
import * as url from 'url';

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

    private async rollBackward(
        response: { point: PointOrOrigin; tip: TipOrOrigin },
        requestNext: () => void
    ): Promise<void> {
        const { current_slot } = HandleStore.getMetrics();
        Logger.log({
            message: `Rollback ocurred at slot: ${current_slot}. Target point: ${JSON.stringify(response.point)}`,
            event: 'OgmiosService.rollBackward',
            category: LogCategory.INFO
        });

        const { point, tip } = response;
        await processRollback(point, tip);
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

        if (this.intervals.length === 0) {
            const saveFilesInterval = setInterval(async () => {
                const { current_slot, current_block_hash } = HandleStore.getMetrics();

                // currentSlot should never be zero. If it is, we don't want to write it and instead exit.
                // Once restarted, we should have a valid file to read from.
                if (current_slot === 0) {
                    Logger.log({
                        message: 'Slot is zero. Exiting process.',
                        category: LogCategory.NOTIFY,
                        event: 'OgmiosService.saveFilesInterval'
                    });
                    process.exit(2);
                }

                await HandleStore.saveHandlesFile(current_slot, current_block_hash);

                memoryWatcher();
            }, 10 * 60 * 1000);

            const setMemoryInterval = setInterval(() => {
                const memorySize = HandleStore.memorySize();
                HandleStore.setMetrics({ memorySize });
            }, 60000);

            this.intervals = [saveFilesInterval, setMemoryInterval];
        }
    }

    public async getStartingPoint(): Promise<Point> {
        const initialStartingPoint = handleEraBoundaries[process.env.NETWORK ?? 'testnet'];
        const handlesContent = await HandleStore.prepareHandlesStorage();

        if (!handlesContent) {
            Logger.log(`Handle storage not found - using starting point: ${JSON.stringify(initialStartingPoint)}`);
            return initialStartingPoint;
        }

        const { slot, hash } = handlesContent;
        return { slot, hash };
    }

    public async startSync() {
        HandleStore.setMetrics({
            currentSlot: handleEraBoundaries[process.env.NETWORK ?? 'testnet'].slot,
            currentBlockHash: handleEraBoundaries[process.env.NETWORK ?? 'testnet'].hash,
            firstSlot: handleEraBoundaries[process.env.NETWORK ?? 'testnet'].slot,
            firstMemoryUsage: this.firstMemoryUsage
        });

        const ogmiosUrl = new url.URL(OGMIOS_HOST);

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
            {
                connection: {
                    host: ogmiosUrl.hostname,
                    port: parseInt(ogmiosUrl.port),
                    tls: ogmiosUrl.protocol.startsWith('https')
                }
            }
        );

        const client = await createLocalChainSyncClient(context, {
            rollForward: this.rollForward,
            rollBackward: this.rollBackward
        });

        const startingPoint = await this.getStartingPoint();
        this.startIntervals();

        await client.startSync(startingPoint.slot == 0 ? ['origin'] : [startingPoint]);
    }
}

export default OgmiosService;
