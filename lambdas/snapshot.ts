import { IHandleFileContent, IndexNames, MintingData, UTxOWithTxInfo } from '@koralabs/kora-labs-common';
import { GlideClient, GlideString } from '@valkey/valkey-glide';
import AWS from 'aws-sdk';
import zlib from 'zlib';
import { RedisHandlesStore } from '../stores/redis';

const s3 = new AWS.S3({ region: 'us-west-2' });

let client: GlideClient | undefined;

async function getRedisItems() {
    const utxos: Map<string, UTxOWithTxInfo | null> = new Map();
    const mints: Map<string, MintingData | null> = new Map();

    let lastSlot = 0;
    let lastHash = '';
    let utxoSchemaVersion = 0;

    try {
        const redisHandleStore = new RedisHandlesStore();
        console.log('Connected to Valkey');

        let cursor: GlideString = '0';
        let totalKeys = 0;

        console.log('Counting keys in database...');

        const metrics = redisHandleStore.getMetrics();
        lastSlot = Number(metrics.currentSlot);
        lastHash = `${metrics.currentBlockHash}`;
        utxoSchemaVersion = Number(metrics.utxoSchemaVersion);

        do {
            const [nextCursor, keys] = await client!.scan(cursor, { count: 1000, match: '{root}:utxo:*' });
            cursor = nextCursor;

            if (keys && keys.length > 0) {
                totalKeys += keys.length;

                // Log progress every 100k keys
                if (totalKeys % 100000 === 0 || totalKeys % 100000 < keys.length) {
                    console.log(`Progress: ${totalKeys.toLocaleString()} keys scanned (cursor: ${cursor})`);
                }

                // check if keys starts with ({root}:utxo_slot | {root}:utxo) and add to utxoKeys
                redisHandleStore.pipeline(() => {
                    for (const key of keys) {
                        const keyParts = `${key}`.split(':');
                        const result = redisHandleStore.getValueFromIndex(IndexNames.UTXO, keyParts[2]) as UTxOWithTxInfo | null;
                        if (result && result?.slot <= lastSlot) utxos.set(keyParts[2], result);
                    }
                });
            }
        } while (cursor !== '0');

        do {
            const [nextCursor, keys] = await client!.scan(cursor, { count: 1000, match: '{root}:mint*' });
            cursor = nextCursor;

            if (keys && keys.length > 0) {
                totalKeys += keys.length;

                // Log progress every 100k keys
                if (totalKeys % 100000 === 0 || totalKeys % 100000 < keys.length) {
                    console.log(`Progress: ${totalKeys.toLocaleString()} keys scanned (cursor: ${cursor})`);
                }

                // check if keys starts with ({root}:utxo_slot | {root}:utxo) and add to utxoKeys
                redisHandleStore.pipeline(() => {
                    for (const key of keys) {
                        const keyParts = `${key}`.split(':');
                        const result = redisHandleStore.getValueFromIndex(IndexNames.MINT, keyParts[2]) as MintingData | null;
                        if (result && result?.created_slot <= lastSlot) mints.set(keyParts[2], result);
                    }
                });
            }
        } while (cursor !== '0');
    } catch (error) {
        console.error('Error counting keys:', error);
    }

    return {
        utxos,
        mints,
        lastSlot,
        lastHash,
        utxoSchemaVersion
    };
}

exports.handler = async (event: any) => {
    const networks = ['mainnet', 'preview', 'preprod'];
    for (let i = 0; i < networks.length; i++) {
        const network = networks[i];
        try {
            const results = await getRedisItems();

            const fileJson: IHandleFileContent = {
                slot: results.lastSlot,
                hash: results.lastHash,
                utxoSchemaVersion: results.utxoSchemaVersion,
                utxos: Array.from(results.utxos.entries().map(([_, v]) => v).filter((v): v is UTxOWithTxInfo => v !== null)),
                mintingData: Array.from(results.mints.entries()).reduce<Record<string, MintingData>>((acc, [k, v]) => {
                    if (v !== null) acc[k] = v;
                    return acc;
                }, {})
            };

            const { utxoSchemaVersion = 1 } = fileJson;
            const fileName = `${network}/snapshot/${utxoSchemaVersion}/handles.gz`;

            const filesData = [
                {
                    Key: fileName,
                    Body: zlib.deflateSync(JSON.stringify(fileJson))
                }
            ];

            const s3Result = await Promise.all(
                filesData.map(({ Key, Body }) => {
                    const params = {
                        Bucket: 'api.handle.me',
                        Key,
                        Body
                    };
                    return s3.putObject(params).promise();
                })
            );

            console.log(`s3Result ${JSON.stringify(s3Result)}`);
        } catch (error: any) {
            console.log(`There was an error: ${error.message}`);
        }
    }

    return {
        statusCode: 200,
        body: ''
    };
};
