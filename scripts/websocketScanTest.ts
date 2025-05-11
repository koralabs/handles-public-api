import { delay, LogCategory, Logger } from "@koralabs/kora-labs-common";
import { randomInt } from "crypto";
import fastq from "fastq";
import * as url from 'url';
import WebSocket from 'ws';


function _rpcRequest(method: string, params: any, id: string | number) {
    client!.send(JSON.stringify({ jsonrpc: '2.0', method, params, id }));
}
let lastSlotNumber = 0;
let unOrderedBlockCount = 0
const client = new WebSocket(new url.URL('http://localhost:1337').toString(), {allowSynchronousEvents: false});
client.on('message', async (message: string) => {
    await fastq.promise(async (msg: string) => {
        const response = JSON.parse(msg);
        switch (response.id) {
            case 'find-intersection':
                for (let i=1; i<=1000; i++) {
                    _rpcRequest('nextBlock', {}, 'next-block');
                }
                break;
            case 'next-block':
                try {
                    switch (response.result.direction) {
                        case 'forward': {
                            const slot = response.result.block.slot;
                            if (slot < lastSlotNumber) {
                                unOrderedBlockCount++;
                            }
                            lastSlotNumber = slot;
                            process.stdout.write(`Processing block ${slot.toString().padEnd(20, ' ')} (Unordered Blocks: ${unOrderedBlockCount.toString().padStart(20, ' ')})\r`);
                            await delay(randomInt(1, 1000));
                        }
                            break;
                        default:
                            break;
                    }
                } catch (error) {
                    Logger.log({ 
                        message: `LastSlotNumber: ${lastSlotNumber}, UnOrderedBlocks: ${unOrderedBlockCount} ERROR: ${JSON.stringify(error)}`, 
                        category: LogCategory.ERROR, 
                        event: 'OgmiosClient.Message'
                    });
                }
                break;

            }
        _rpcRequest('nextBlock', {}, 'next-block');
    }, 1).push(message);
});

client.on('error', (error) => {
    Logger.log({ message: `OgmiosClient Error: ${error}`, category: LogCategory.ERROR, event: 'OgmiosClient.Error' });
});

client!.once('open', () => {
    _rpcRequest('findIntersection', { points: [{
        slot: 47931333,
        id: '847543d30b99cbb288bee3064f83ff50140cf944ce60fa5d356f27611e94b1f0'
    }] }, 'find-intersection');
});