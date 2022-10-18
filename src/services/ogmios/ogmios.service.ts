import { createChainSyncClient, createInteractionContext, InteractionContext } from '@cardano-ogmios/client';
import { BlockTip, TxBlock } from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { Logger } from '../../utils/logger';
import { writeConsoleLine } from '../../utils/util';
import { handleEraBoundaries, Point, POLICY_IDS } from './constants';
import { processBlock } from './processBlock';

const firstMemoryUsage = process.memoryUsage().rss;
const startTime = new Date().getTime();

// TODO: !Figure out how to Handle rollbacks!

let startOgmiosExec = 0;

class OgmiosService {
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
        Logger.log(`ROLLBACK POINT: ${JSON.stringify(response.point)}`);
        requestNext();
    }

    private startIntervals() {
        setInterval(() => {
            const { percentageComplete, currentMemoryUsed, memorySize, buildingElapsed, ogmiosElapsed, slotDate } =
                HandleStore.getMetrics();

            writeConsoleLine(
                startTime,
                `${percentageComplete}% Completed | ${currentMemoryUsed}MB Used | ${HandleStore.count()} Total Handles | ${memorySize} Object Size | ${ogmiosElapsed} Ogmios Elapsed | ${buildingElapsed} Building Elapsed | ${slotDate.toISOString()} Slot Date`
            );
        }, 1000);

        setInterval(() => {
            const { currentSlot, currentBlockHash } =
                HandleStore.getMetrics();
            HandleStore.saveFile(currentSlot, currentBlockHash);
        }, 30000);
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
            firstMemoryUsage
         })

        const context: InteractionContext = await createInteractionContext(
            (err) => console.error(err),
            () => Logger.log('Connection closed.'),
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
