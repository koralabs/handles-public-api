import { createInteractionContext, createStateQueryClient, InteractionContext } from '@cardano-ogmios/client';
import { StateQueryClient } from '@cardano-ogmios/client/dist/StateQuery';
import { Logger } from '@koralabs/kora-labs-common';

const connectToStateClient = async (): Promise<StateQueryClient> => {
    const context: InteractionContext = await createInteractionContext(
        (err) => console.error(err),
        () => {
            Logger.log('Connection closed.');
        },
        { connection: { port: 1337 } }
    );

    return await createStateQueryClient(context);
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

    // Close the connection when done.
    await client.shutdown();

    return utxoResult;
};
