import fastq from 'fastq';
import { createPointFromCurrentTip, ensureSocketIsOpen, InteractionContext, safeJSON } from '@cardano-ogmios/client';
import { findIntersect, Intersection, requestNext, UnknownResultError } from '@cardano-ogmios/client/dist/ChainSync';
import { Block, Ogmios, PointOrOrigin, TipOrOrigin } from '@cardano-ogmios/schema';
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
export const createLocalChainSyncClient = async (
    context: InteractionContext,
    messageHandlers: ChainSyncMessageHandlers,
    options?: { sequential?: boolean }
): Promise<ChainSyncClient> => {
    const { socket } = context;
    return new Promise((resolve) => {
        const messageHandler = async (response: Ogmios['RequestNextResponse']) => {
            if ('RollBackward' in response.result) {
                await messageHandlers.rollBackward(
                    {
                        point: response.result.RollBackward.point,
                        tip: response.result.RollBackward.tip
                    },
                    () => requestNext(socket)
                );
            } else if ('RollForward' in response.result) {
                await messageHandlers.rollForward(
                    {
                        block: response.result.RollForward.block,
                        tip: response.result.RollForward.tip
                    },
                    () => {
                        requestNext(socket);
                    }
                );
            } else {
                throw new UnknownResultError(response.result);
            }
        };

        const responseHandler = fastq.promise(messageHandler, 1).push;

        const processMessage = async (message: string) => {
            const policyIds = POLICY_IDS[process.env.NETWORK ?? 'preview'];
            let processTheBlock = false;

            // check if the message contains the Handle policy ID or is a RollBackward
            if (message.indexOf('"result":{"RollBackward"') >= 0) {
                processTheBlock = true;
            } else {
                //console.log('MESSAGE', message);
                processTheBlock = policyIds.some((pId) => message.indexOf(pId) >= 0);
                const ogmiosStatus = await fetchHealth();
                let slotMatch: string | null = (message.match(/"header":{(?:(?!"slot").)*"slot":\s?(\d*)/m) || ['', '0'])[1];
                let blockMatch: string | null = (message.match(/"headerHash":\s?"([0-9a-fA-F]*)"/m) || ['', ''])[1];
                let tipSlotMatch: string | null = (message.match(/"tip":.*?"slot":\s?(\d*)/m) || ['', '0'])[1];
                let tipHashMatch: string | null = (message.match(/"tip":.*?"hash":\s?"([0-9a-fA-F]*)"/m) || ['', '0'])[1];
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
                const response: Ogmios['RequestNextResponse'] = safeJSON.parse(message);
                if (response.methodname === 'RequestNext') {
                    try {
                        await responseHandler(response);
                        return;
                    } catch (error) {
                        console.error(error);
                    }
                }
            }

            requestNext(socket);
        };

        return resolve({
            context,
            shutdown: async () => {
                    if (socket.CONNECTING || socket.OPEN) {
                        socket.close();
                    }
                },
            startSync: async (points, inFlight) => {
                const intersection = await findIntersect(context, points || [await createPointFromCurrentTip(context)]);
                ensureSocketIsOpen(socket);
                socket.on('message', async (message: string) => {
                    await processMessage(message);
                });
                for (let n = 0; n < (inFlight || 100); n += 1) {
                    requestNext(socket);
                }
                return intersection;
            }
        });
    });
};
