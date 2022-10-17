import { createChainSyncClient, createInteractionContext, InteractionContext } from '@cardano-ogmios/client';
import { BlockTip, TxBlock } from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { writeConsoleLine } from '../../utils/util';
import { handleEraBoundaries, Point, POLICY_IDS } from './constants';
import { processBlock } from './processBlock';

const firstMemoryUsage = process.memoryUsage().rss;
const startTime = new Date().getTime();

// TODO: Add tests

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
        HandleStore.setMetrics({ elapsedOgmiosExec: (HandleStore.metrics.elapsedOgmiosExec ?? 0) + ogmiosExecFinished  });

        const policyId = POLICY_IDS[process.env.NETWORK ?? 'testnet'][0];
        processBlock({ policyId, txBlock: response.block as TxBlock, tip: response.tip as BlockTip });

        // start timer for ogmios rollForward
        startOgmiosExec = Date.now();
        requestNext();
    }

    private async rollBackward(response: { point: unknown }, requestNext: () => void): Promise<void> {
        console.log('ROLLBACK POINT', response.point);
        requestNext();
    }

    private startIntervals() {
        setInterval(() => {
            const { percentageComplete, currentMemoryUsed, memorySize, buildingElapsed, ogmiosElapsed } =
                HandleStore.getMetrics();

            writeConsoleLine(
                startTime,
                `${percentageComplete}% Completed, ${currentMemoryUsed}MB Used, ${HandleStore.count()} Total Handles, ${memorySize} Object Size, ${ogmiosElapsed} Ogmios Elapsed, ${buildingElapsed} Building Elapsed`
            );
        }, 1000);

        setInterval(() => {
            const currentSlot = HandleStore.metrics.currentSlot ?? 0;
            const currentBlockHash = HandleStore.metrics.currentBlockHash ?? '';
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
            console.log(
                `Handle storage found at slot: ${slot} and hash: ${hash} with ${
                    Object.keys(handles ?? {}).length
                } handles`
            );
            startingPoint = { slot, hash };
        } else {
            console.log('Handle storage not found');
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
            () => console.log('Connection closed.'),
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
