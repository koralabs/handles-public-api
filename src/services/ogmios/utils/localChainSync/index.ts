import fastq from 'fastq';
import { ensureSocketIsOpen, InteractionContext, safeJSON } from '@cardano-ogmios/client';
import { ChainSynchronizationClient, findIntersection, Intersection, nextBlock } from '@cardano-ogmios/client/dist/ChainSynchronization';
import { Block, Ogmios, Point, PointOrOrigin, TipOrOrigin } from '@cardano-ogmios/schema';
import { POLICY_IDS } from '../../constants';
import { HandleStore } from '../../../../repositories/memory/HandleStore';
import { fetchHealth } from '..';

/**
 * Local Chain Sync client specifically for ADA Handles API.
 *
 * This client's purpose is the make sure we are only working with assets that include the ADA Handle policy ID before we parse the block json.
 *
 * @category ChainSync
 */
export interface ChainSyncClient {
    context: InteractionContext;
    shutdown: () => Promise<void>;
    startSync: (points?: PointOrOrigin[], inFlight?: number) => Promise<Intersection>;
}

/** @category ChainSync */
export interface ChainSyncMessageHandlers {
    rollBackward: (
        response: {
            point: PointOrOrigin;
            tip: TipOrOrigin;
        },
        requestNext: () => void
    ) => Promise<void>;
    rollForward: (
        response: {
            block: Block;
            tip: TipOrOrigin;
        },
        requestNext: () => void
    ) => Promise<void>;
}

/** @category Constructor */
export const createLocalChainSyncClient = async (context: InteractionContext, messageHandlers: ChainSyncMessageHandlers, options?: { sequential?: boolean }): Promise<ChainSynchronizationClient> => {
    const { socket } = context;
    return new Promise((resolve) => {
        const messageHandler = async (response: Ogmios['NextBlockResponse']) => {
            if (isNextBlockResponse(response)) {
                switch (response.result.direction) {
                    case 'backward':
                        return await messageHandlers.rollBackward(
                            {
                                point: response.result.point,
                                tip: response.result.tip
                            },
                            () => nextBlock(socket)
                        );
                    case 'forward':
                        return await messageHandlers.rollForward(
                            {
                                block: response.result.block,
                                tip: response.result.tip
                            },
                            () => nextBlock(socket)
                        );
                    default:
                        break;
                }
            }
        };

        const responseHandler = fastq.promise(messageHandler, 1).push;

        const processMessage = async (message: string) => {
            const policyIds = POLICY_IDS[process.env.NETWORK ?? 'preview'];
            let processTheBlock = false;

            // check if the message contains the Handle policy ID or is a RollBackward
            if (message.indexOf('"result":{"direction":"backward"') >= 0) {
                processTheBlock = true;
            } else {
                //console.log('MESSAGE', message);
                processTheBlock = policyIds.some((pId) => message.indexOf(pId) >= 0);
                const ogmiosStatus = await fetchHealth();
                // SEE ./docs/ogmios-block.json
                let slotMatch: string | null = (message.match(/"block":{(?:(?!"slot").)*"slot":\s?(\d*)/m) || ['', '0'])[1];
                let blockMatch: string | null = (message.match(/"block":{(?:(?!"id").)*"id":\s?([0-9a-fA-F]*)/m) || ['', '0'])[1];
                let tipSlotMatch: string | null = (message.match(/"tip":.*?"slot":\s?(\d*)/m) || ['', '0'])[1];
                let tipHashMatch: string | null = (message.match(/"tip":.*?"id":\s?"([0-9a-fA-F]*)"/m) || ['', '0'])[1];
                //console.log({slotMatch, blockMatch, tipSlotMatch});
                HandleStore.setMetrics({
                    currentSlot: parseInt(slotMatch),
                    currentBlockHash: blockMatch,
                    tipBlockHash: tipHashMatch,
                    lastSlot: parseInt(tipSlotMatch),
                    networkSync: ogmiosStatus?.networkSynchronization
                });
                slotMatch = blockMatch = tipSlotMatch = null;
            }

            if (processTheBlock) {
                const response: Ogmios['NextBlockResponse'] = safeJSON.parse(message);
                if (response.method === 'nextBlock') {
                    try {
                        await responseHandler(response);
                        return;
                    } catch (error) {
                        console.error(error);
                    }
                }
            }

            nextBlock(socket);
        };

        return resolve({
            context,
            shutdown: async () => {
                if (socket.CONNECTING || socket.OPEN) {
                    socket.close();
                }
            },
            resume: async (points, inFlight) => {
                const intersection = await findIntersection(context, points || [await createPointFromCurrentTip(context)]);
                ensureSocketIsOpen(socket);
                socket.on('message', async (message: string) => {
                    await processMessage(message);
                });
                for (let n = 0; n < (inFlight || 100); n += 1) {
                    nextBlock(socket);
                }
                return intersection;
            }
        });
    });
};

/** @category ChainSynchronization */
export class TipIsOriginError extends Error {
    public constructor() {
        super();
        this.message = 'Unable to produce point as the chain tip is the origin';
    }
}

/** @internal */
export async function createPointFromCurrentTip(context: InteractionContext): Promise<Point> {
    const { tip } = await findIntersection(context, ['origin']);
    if (tip === 'origin') {
        throw new TipIsOriginError();
    }
    return {
        id: tip.id,
        slot: tip.slot
    } as Point;
}

/** @internal */
export function isNextBlockResponse(response: any): response is Ogmios['NextBlockResponse'] {
    return typeof (response as Ogmios['NextBlockResponse'])?.result?.direction !== 'undefined';
}
