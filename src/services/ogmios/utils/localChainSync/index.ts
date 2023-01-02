import fastq from 'fastq';
import { createPointFromCurrentTip, ensureSocketIsOpen, InteractionContext, safeJSON } from '@cardano-ogmios/client';
import { findIntersect, Intersection, requestNext, UnknownResultError } from '@cardano-ogmios/client/dist/ChainSync';
import { Block, Ogmios, PointOrOrigin, TipOrOrigin } from '@cardano-ogmios/schema';
import { POLICY_IDS } from '../../constants';

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
            const policyId = POLICY_IDS[process.env.NETWORK ?? 'testnet'][0];
            if (message.indexOf('"result":{"RollBackward"') >= 0 || message.indexOf(policyId) >= 0) {
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

        socket.on('message', async (message: string) => {
            await processMessage(message);
        });

        return resolve({
            context,
            shutdown: () =>
                new Promise((resolve) => {
                    ensureSocketIsOpen(socket);
                    socket.once('close', resolve);
                    socket.close();
                }),
            startSync: async (points, inFlight) => {
                const intersection = await findIntersect(context, points || [await createPointFromCurrentTip(context)]);
                ensureSocketIsOpen(socket);
                for (let n = 0; n < (inFlight || 100); n += 1) {
                    requestNext(socket);
                }
                return intersection;
            }
        });
    });
};
