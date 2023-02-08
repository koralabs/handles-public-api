import { createInteractionContext, createStateQueryClient, InteractionContext } from '@cardano-ogmios/client';
import { StateQueryClient } from '@cardano-ogmios/client/dist/StateQuery';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';

let client: StateQueryClient | null = null;

const connectToStateClient = async (): Promise<StateQueryClient> => {
    const context: InteractionContext = await createInteractionContext(
        (err) => {
            Logger.log({
                message: `Error creating context: ${JSON.stringify(err)}`,
                event: 'OgmiosService.connectToStateClient',
                category: LogCategory.ERROR
            });
            client = null;
        },
        () => {
            Logger.log('Connection closed.');
            client = null;
        },
        { connection: { port: 1337 } }
    );

    return client ?? (await createStateQueryClient(context));
};

export const queryStateByUtxo = async (utxo: string) => {
    const client = await connectToStateClient();

    const [txId, index] = utxo.split('#');
    const utxoResult = await client.utxo([
        {
            txId,
            index: parseInt(index)
        }
    ]);

    return utxoResult;
};
