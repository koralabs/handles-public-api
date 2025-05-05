import { BlockPraos, NextBlockResponse, Point, PointOrOrigin, RollForward, Tip, TipOrOrigin, Transaction } from '@cardano-ogmios/schema';
import { AssetNameLabel, checkNameLabel, delay, HANDLE_POLICIES, LogCategory, Logger, NETWORK, Network } from '@koralabs/kora-labs-common';
import fastq from 'fastq';
import * as url from 'url';
import WebSocket from 'ws';
import { OGMIOS_HOST } from '../../config';
import { handleEraBoundaries } from '../../config/constants';
import { HandleOnChainMetadata, MetadataLabel, ScannedHandleInfo } from '../../interfaces/ogmios.interfaces';
import { HandlesRepository } from '../../repositories/handlesRepository';
import { getHandleNameFromAssetName } from './utils';

let startOgmiosExec = 0;

class OgmiosService {
    private startTime: number;
    private firstMemoryUsage: number;
    private handlesRepo: HandlesRepository;
    client?: WebSocket;
    processBlockCallback?: (block: NextBlockResponse) => Promise<void>;

    constructor(handlesRepo: HandlesRepository, processBlockCallback?: (block: NextBlockResponse) => Promise<void>) {
        this.handlesRepo = handlesRepo;
        this.startTime = Date.now();
        this.firstMemoryUsage = process.memoryUsage().rss;
        this.processBlockCallback = processBlockCallback;
    }

    public async initialize(reset: () => Promise<void>, load: () => Promise<void>) {
        this.handlesRepo.setMetrics({
            currentSlot: handleEraBoundaries[process.env.NETWORK ?? 'preview'].slot,
            currentBlockHash: handleEraBoundaries[process.env.NETWORK ?? 'preview'].id,
            firstSlot: handleEraBoundaries[process.env.NETWORK ?? 'preview'].slot,
            firstMemoryUsage: this.firstMemoryUsage
        });

        await this.handlesRepo.initialize();

        // attempt ogmios resume (see if starting point exists or errors)
        const firstStartingPoint = await this.handlesRepo.getStartingPoint(this.handlesRepo.save.bind(this.handlesRepo));

        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                if (!this.client) {
                    this.client = this._createWebSocketClient();
                }
                if (!firstStartingPoint) {                    
                    const initialStartingPoint = handleEraBoundaries[process.env.NETWORK ?? 'preview'];
                    await reset();
                    await this._resume(initialStartingPoint);
                    break;
                } else {
                    try {
                        await load();
                        await this._resume(firstStartingPoint);
                        break;
                    } catch (error: any) {
                        Logger.log({ message: `Error initializing Handles: ${error.message} code: ${error.code}`, category: LogCategory.ERROR, event: 'initializeStorage.firstFileFailed' });
                        const secondStartingPoint = await this.handlesRepo.getStartingPoint(this.handlesRepo.save, true);
                        // If error, try the other file's starting point
                        if (error.code === 1000) {
                            this.handlesRepo.destroy();
                            if (secondStartingPoint) {
                                try {
                                    await load();
                                    await this._resume(secondStartingPoint);
                                    break;
                                } catch (error: any) {
                                    if (error.code === 1000) {
                                        // this means the slot that came back from the files is bad
                                        await reset();
                                        process.exit(2);
                                    }
                                    throw error;
                                }
                            }
                        }
                    }
                }
                if (this.client) 
                    if (this.client.CONNECTING || this.client.OPEN)
                        this.client.close();
            } catch (error: any) {
                Logger.log({
                    message: `Unable to connect Ogmios: ${error.message}`,
                    category: LogCategory.ERROR,
                    event: 'initializeStorage.failed.errorMessage'
                });
                
                if (this.client) 
                    if (this.client.CONNECTING || this.client.OPEN)
                        this.client.close();
            }
            await delay(30 * 1000);
        }
    }

    private _createWebSocketClient(): WebSocket {
        const client = new WebSocket(new url.URL(OGMIOS_HOST).toString());
        client.on('message', async (message: string) => {
            await fastq.promise(async (msg: string) => {
                const response  = JSON.parse(msg);
                switch (response.id) {
                    case 'find-intersection':
                        for (let i=1; i<=1000; i++) {
                            this._rpcRequest('nextBlock', {}, 'next-block');
                        }
                        break;
                    case 'next-block':
                        try {
                            switch (response.result.direction) {
                                case 'backward': {
                                    const { currentSlot } = this.handlesRepo.getMetrics();
                                    Logger.log({
                                        message: `Rollback occurred at slot: ${currentSlot}. Target point: ${JSON.stringify(response.result.point)}`,
                                        event: 'OgmiosService.rollBackward',
                                        category: LogCategory.INFO
                                    });
                                    await this.processRollback(response.result.point, response.result.tip);
                                    break;
                                }
                                case 'forward': {
                                    try {
                                        const result = response.result as RollForward;
                                        this.handlesRepo.setMetrics({
                                            currentSlot: (result.block as BlockPraos).slot,
                                            currentBlockHash: result.block.id,
                                            tipBlockHash: result.tip.id,
                                            lastSlot: result.tip.slot
                                        });
                                        // finish timer for ogmios rollForward
                                        const ogmiosExecFinished = startOgmiosExec === 0 ? 0 : Date.now() - startOgmiosExec;
                                        const { elapsedOgmiosExec } = this.handlesRepo.getMetrics();
                                        this.handlesRepo.setMetrics({ elapsedOgmiosExec: (elapsedOgmiosExec ?? 0) + ogmiosExecFinished });

                                        if (result.block.type !== 'praos') {
                                            throw new Error(`Block type ${result.block.type} is not supported`);
                                        }

                                        const block = { txBlock: result.block as BlockPraos, tip: result.tip as Tip };

                                        await this.processBlock(block);

                                        // start timer for ogmios rollForward
                                        startOgmiosExec = Date.now();
                                    }
                                    catch (error: any) {
                                        Logger.log({
                                            message: `Unhandled error processing block:\nBLOCK: ${JSON.stringify(response.result.block.id)}\nERROR:${error.message}`,
                                            category: LogCategory.NOTIFY,
                                            event: 'OgmiosService.processBlock'
                                        });
                                        //process.exit(1);
                                    }
                                }
                                    break;
                                default:
                                    break;
                            }
                            if (this.processBlockCallback) await this.processBlockCallback(response);
                        } catch (error) {
                            Logger.log({ message: JSON.stringify(error), category: LogCategory.ERROR, event: 'OgmiosClient.Message' });
                        }
                        break;
                }
                this._rpcRequest('nextBlock', {}, 'next-block');
            }, 1).push(message);
        })
        client.on('error', (error) => {
            Logger.log({ message: `OgmiosClient Error: ${error}`, category: LogCategory.ERROR, event: 'OgmiosClient.Error' });
        });
        return client;
    }

    private async _resume(startingPoint: Point) { 
        //startingPoint = {slot: 99999810, id: 'a270ecc9f374b82a9a5e027ba862593ef95cd10f4535dc1fe851babe03a0dec9'}; // TODO: remove this line
        this.handlesRepo.setMetrics({ currentSlot: startingPoint.slot, currentBlockHash: startingPoint.id });
        this.client!.once('open', () => {
            this._rpcRequest('findIntersection', { points: startingPoint.slot == 0 ? ['origin'] : [startingPoint] }, 'find-intersection');
        });
    }

    private _rpcRequest(method: string, params: any, id: string | number) {
        this.client!.send(JSON.stringify({ jsonrpc: '2.0', method, params, id }));
    }

    private processBlock = async ({ txBlock, tip }: { txBlock: BlockPraos; tip: Tip }) => {
        const startBuildingExec = Date.now();

        const lastSlot = tip.slot;
        const currentSlot = txBlock?.slot ?? 0;
        const currentBlockHash = txBlock.id ?? '0';
        const tipBlockHash = tip?.id ?? '1';

        this.handlesRepo.setMetrics({ lastSlot, currentSlot, currentBlockHash, tipBlockHash });

        for (let b = 0; b < (txBlock?.transactions ?? []).length; b++) {
            const txBody = txBlock?.transactions?.[b];
            const txId = txBody?.id;

            // Look for burn transactions
            
            //const assetNameInMintAssets = txBody?.mint?.[policyId]?.[assetName] !== undefined;
            const mintAssets = Object.entries(txBody?.mint ?? {});
            for (let i = 0; i < mintAssets.length; i++) {
                const [policy, assetInfo] = mintAssets[i];
                if (HANDLE_POLICIES.contains(NETWORK as Network, policy)) {
                    for (const [assetName, quantity] of Object.entries(assetInfo)) {
                        if (quantity == BigInt(-1)) {
                            const { name } = getHandleNameFromAssetName(assetName);
                            const handle = this.handlesRepo.get(name);
                            if (!handle) continue;
                            await this.handlesRepo.removeHandle(handle, currentSlot);
                        }
                    }
                }
            }

            // Iterate through all the outputs and find asset keys that start with our policyId
            for (let i = 0; i < (txBody?.outputs ?? []).length; i++) {
                const o = txBody?.outputs[i];
                const values = Object.entries(o?.value ?? {}).filter(([policyId]) => HANDLE_POLICIES.contains(NETWORK as Network, policyId));
                for (const [policyId, assets] of values) {
                    for (const [assetName] of Object.entries(assets ?? {})) {
                        const { datum = null, script: outputScript } = o!;

                        // We need to get the datum. This can either be a string or json object.
                        let datumString;
                        try {
                            datumString = !datum ? undefined : typeof datum === 'string' ? datum : JSON.stringify(datum);
                        } catch {
                            Logger.log({
                                message: `Error decoding datum for ${txId}`,
                                category: LogCategory.ERROR,
                                event: 'processBlock.decodingDatum'
                            });
                        }
                        const isMintTx = this.isMintingTransaction(assetName, policyId, txBody);
                        if (assetName === policyId) {
                            // Don't process the nameless token.
                            continue;
                        }

                        let script: { type: string; cbor: string } | undefined;
                        if (outputScript) {
                            try {
                                script = {
                                    type: outputScript.language.replace(':', '_'),
                                    cbor: outputScript.cbor ?? ''
                                };
                            } catch {
                                Logger.log({ message: `Error error getting script for ${txId}`, category: LogCategory.ERROR, event: 'processBlock.decodingScript' });
                            }
                        }

                        const handleMetadata: { [handleName: string]: HandleOnChainMetadata } | undefined = (txBody?.metadata?.labels?.[MetadataLabel.NFT]?.json as any)?.[policyId];

                        const scannedHandleInfo: ScannedHandleInfo = {
                            assetName,
                            address: o!.address,
                            slotNumber: currentSlot,
                            utxo: `${txId}#${i}`,
                            policy: policyId,
                            lovelace: parseInt(o!.value['ada'].lovelace.toString()),
                            datum: datumString,
                            script,
                            metadata: handleMetadata,
                            isMintTx
                        };

                        await this.handlesRepo.processScannedHandleInfo(scannedHandleInfo);
                    }
                }
            }
        }

        // finish timer for our logs
        const buildingExecFinished = Date.now() - startBuildingExec;
        const { elapsedBuildingExec } = this.handlesRepo.getMetrics();
        this.handlesRepo.setMetrics({ elapsedBuildingExec: elapsedBuildingExec ?? 0 + buildingExecFinished });
    };

    private isMintingTransaction = (assetName: string, policyId: string, txBody?: Transaction) => {
        const assetNameInMintAssets = txBody?.mint?.[policyId]?.[assetName] !== undefined;
        // is CIP67 is false OR is CIP67 is true and label is 222
        const { isCip67, assetLabel } = checkNameLabel(assetName);
        if (isCip67) {
            if (assetLabel === AssetNameLabel.LBL_222) {
                return assetNameInMintAssets;
            }
            return false;
        }
        // not cip68
        return assetNameInMintAssets;
    };
    
    private processRollback = async (point: PointOrOrigin, tip: TipOrOrigin) => {
        if (point === 'origin') {
            // this is a rollback to genesis. We need to clear the memory store and start over
            Logger.log(`ROLLBACK POINT: ${JSON.stringify(point)}`);
            await this.handlesRepo.rollBackToGenesis();
        } else {
            const { slot, id } = point;
            let lastSlot = 0;
            if (tip !== 'origin') {
                lastSlot = tip.slot;
            }

            // The idea here is we need to rollback all changes from a given slot
            await this.handlesRepo.rewindChangesToSlot({ slot, hash: id, lastSlot });
        }
    };
}

export default OgmiosService;