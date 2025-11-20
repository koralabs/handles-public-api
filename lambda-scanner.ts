import { BlockPraos, Transaction } from '@cardano-ogmios/schema';
import { decodeCborToJson, NETWORK } from '@koralabs/kora-labs-common';
import { fetch } from 'cross-fetch';
import { HandlesRepository } from './repositories/handlesRepository';
import { processBlock } from './services/processBlock';
import { RedisHandlesStore } from './stores/redis';

const blockfrostApiCall = async (endpointSegment: string) => {
    const headers = {
        project_id: process.env.BLOCKFROST_API_KEY ?? '',
        'Content-Type': 'application/json'
    };

    const url = `https://cardano-${NETWORK.toLowerCase()}.blockfrost.io/api/v0/${endpointSegment}`;
    return await fetch(url, {headers})
};

export const lambdaHandler = async (event: AWSLambda.ALBEvent, context:AWSLambda.Context) => {
    
    // Get last block from Valkey
    let handlesRepo = new HandlesRepository(new RedisHandlesStore());
    const { currentSlot, currentBlockHash } = handlesRepo.getMetrics();
    
    // - Get blocks fom Blockfrost
    const bResp: {hash: string, slot: number}[] = await (await blockfrostApiCall(`blocks/${currentBlockHash}/next`)).json()
    for (const b of bResp) {
        const block = {id: b.hash, slot: b.slot, transactions: [] as Transaction[]}

        const tResp: { tx_hash: string, cbor: string}[] = await (await blockfrostApiCall(`blocks/${b.hash}/txs/cbor`)).json()
        for (const t of tResp) {
            // - Convert to format that processBlock expects    
            const txParsed = decodeCborToJson({ cborString: t.cbor}); 
            const tx: Transaction = {
                mint: txParsed[1],
                id: '',
                spends: 'inputs',
                inputs: [],
                outputs: [],
                signatories: []
            }
            block.transactions.push(tx);
        }        

        // - Call processBlock
        processBlock(block as unknown as BlockPraos, handlesRepo) 

        handlesRepo.setMetrics({
            currentSlot: block.slot,
            currentBlockHash: block.id,
            tipBlockHash: bResp[bResp.length - 1].hash,
            lastSlot: bResp[bResp.length - 1].slot
        });
    }
    
    return {
        isBase64Encoded: false,
        statusCode: 200,
        body: ''
    };
};
