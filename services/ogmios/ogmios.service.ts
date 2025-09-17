import { BlockPraos, NextBlockResponse, Point, PointOrOrigin, RollForward, Tip, TipOrOrigin, Transaction } from '@cardano-ogmios/schema';
import { AssetNameLabel, checkNameLabel, delay, getDateStringFromSlot, HANDLE_POLICIES, LogCategory, Logger, NETWORK, Network } from '@koralabs/kora-labs-common';
import fastq from 'fastq';
import fs from 'fs';
import * as url from 'url';
import WebSocket from 'ws';
import { OGMIOS_HOST } from '../../config';
import { ACCEPTABLE_TIP_PROXIMITY, handleEraBoundaries, ScanningMode } from '../../config/constants';
import { HandleOnChainMetadata, MetadataLabel, ScannedHandleInfo } from '../../interfaces/ogmios.interfaces';
import { HandlesRepository } from '../../repositories/handlesRepository';
import { HandlesMemoryStore, HandleStore } from '../../stores/memory';
import { getHandleNameFromAssetName } from './utils';

let firstBlockProcessed = false;

class OgmiosService {
    private firstMemoryUsage: number;
    private handlesRepo: HandlesRepository;
    private scanningRepo: HandlesRepository;
    private scanningMode = ScanningMode.BACKFILL;
    client?: WebSocket;
    processBlockCallback?: (block: NextBlockResponse) => Promise<void>;

    constructor(handlesRepo: HandlesRepository, processBlockCallback?: (block: NextBlockResponse) => Promise<void>) {
        this.scanningRepo = new HandlesRepository(new HandlesMemoryStore());
        this.handlesRepo = handlesRepo;
        this.firstMemoryUsage = process.memoryUsage().rss;
        this.processBlockCallback = processBlockCallback;
    }

    public async initialize(reset: () => Promise<void>, load: () => Promise<void>) {
        await this.scanningRepo.initialize();
        await this.handlesRepo.initialize();

        this.scanningRepo.setMetrics({
            currentSlot: handleEraBoundaries[process.env.NETWORK ?? 'preview'].slot,
            currentBlockHash: handleEraBoundaries[process.env.NETWORK ?? 'preview'].id,
            firstSlot: handleEraBoundaries[process.env.NETWORK ?? 'preview'].slot,
            firstMemoryUsage: this.firstMemoryUsage,
            startTimestamp: Date.now()
        });

        // attempt ogmios resume (see if starting point exists or errors)
        const firstStartingPoint = await this.scanningRepo.getStartingPoint(this.scanningRepo.save.bind(this.scanningRepo));
        // const firstStartingPoint = {id: 'eca47c4fb9ca7f8eb2c524b975da3db1d05ced0a9ef0c4ee2c40c4cf2fcb3ea5', slot: 134281477} as Point

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
                        const secondStartingPoint = await this.scanningRepo.getStartingPoint(this.scanningRepo.save, true);
                        // If error, try the other file's starting point
                        if (error.code === 1000) {
                            this.scanningRepo.destroy();
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
                    if (this.client.CONNECTING || this.client.OPEN) {
                        this.client.close();
                        this.client = undefined;
                    }
            } catch (error: any) {
                Logger.log({ message: `Unable to connect Ogmios: ${error.message}`, category: LogCategory.ERROR, event: 'initializeStorage.failed.errorMessage' });
                if (this.client) 
                    if (this.client.CONNECTING || this.client.OPEN) {
                        this.client.close();
                        this.client = undefined;
                    }
            }
            await delay(30 * 1000);
        }
    }

    private _createWebSocketClient(): WebSocket {
        const client = new WebSocket(new url.URL(OGMIOS_HOST).toString(), {allowSynchronousEvents: false});
        client.on('message', fastq.promise(async (msg: string) => {
            const response = JSON.parse(msg);
            switch (response.id) {
                case 'find-intersection':
                    for (let i=1; i<=100; i++) {
                        this._rpcRequest('nextBlock', {}, 'next-block');
                    }
                    break;
                case 'next-block':
                    try {
                        switch (response.result.direction) {
                            case 'backward': {
                                Logger.log({
                                    message: `Rollback occurred to slot: ${JSON.stringify(response.result.point)}`,
                                    event: 'OgmiosService.rollBackward',
                                    category: LogCategory.INFO
                                });
                                this.processRollback(response.result.point, response.result.tip);
                                break;
                            }
                            case 'forward': {
                                try {
                                    const result = response.result as RollForward;
                                    
                                    if (result.block.type !== 'praos')
                                        throw new Error(`Block type ${result.block.type} is not supported`);

                                    const block = result.block as BlockPraos

                                    if (!firstBlockProcessed) {
                                        firstBlockProcessed = true;
                                        if (block.slot >= result.tip.slot - ACCEPTABLE_TIP_PROXIMITY) {
                                            if ((this.handlesRepo.getMetrics().currentSlot ?? 0) >= block.slot) {
                                                Logger.log('Starting in TIP mode')
                                                this.scanningMode = ScanningMode.TIP
                                            }
                                        }
                                    }
                                    if (this.scanningMode == ScanningMode.BACKFILL && block.slot == result.tip.slot) {
                                        this.handlesRepo.bulkLoad(this.scanningRepo);
                                        this.scanningMode = ScanningMode.TIP;
                                    }

                                    await this.processBlock({ txBlock: block, tip: result.tip as Tip });    
                                                                    
                                    const metrics = {
                                        currentSlot: block.slot,
                                        currentBlockHash: block.id,
                                        tipBlockHash: result.tip.id,
                                        lastSlot: result.tip.slot
                                    }
                                    
                                    this.scanningRepo.setMetrics(metrics);
                                    if (this.scanningMode == ScanningMode.TIP)
                                        this.handlesRepo.setMetrics(metrics);
                                }
                                catch (error: any) {
                                    Logger.log({
                                        message: `Unhandled error processing block: BLOCK: ${JSON.stringify(response.result.block.id)} ERROR:${error.message} STACK: ${error.stack}`,
                                        category: LogCategory.NOTIFY,
                                        event: 'OgmiosService.processBlock'
                                    });
                                    fs.writeFileSync('wtf.json', JSON.stringify(HandleStore.slotHistoryIndex))
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
        }, 1).push)
        client.on('error', (error) => {
            Logger.log({ message: `OgmiosClient Error: ${error}`, category: LogCategory.ERROR, event: 'OgmiosClient.Error' });
        });
        return client;
    }

    private async _resume(startingPoint: Point) {
        while (this.client!.readyState != WebSocket.OPEN) {
            await delay(250);
        }
        Logger.log(`Resuming index at slot ${startingPoint.slot} and hash ${startingPoint.id} (${getDateStringFromSlot(startingPoint.slot)})`);
        this.scanningRepo.setMetrics({ firstSlot: handleEraBoundaries[NETWORK].slot, currentSlot: startingPoint.slot, currentBlockHash: startingPoint.id });
        this._rpcRequest('findIntersection', { points: startingPoint.slot == 0 ? ['origin'] : [startingPoint] }, 'find-intersection');
    }

    private _rpcRequest(method: string, params: any, id: string | number) {
        this.client!.send(JSON.stringify({ jsonrpc: '2.0', method, params, id }));
    }

    private processBlock = async ({ txBlock, tip }: { txBlock: BlockPraos; tip: Tip }) => {
        const currentSlot = txBlock?.slot ?? this.scanningRepo.getMetrics().currentSlot ?? 0;
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
                            const { name, isCip67 } = getHandleNameFromAssetName(assetName);
                            if (!isCip67 || assetName.startsWith(AssetNameLabel.LBL_222) || assetName.startsWith(AssetNameLabel.LBL_000)) {
                                const handle = this.scanningRepo.getHandle(name);
                                if (!handle) continue;
                                this.scanningRepo.removeHandle(handle, currentSlot);
                            }
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
                        if (assetName === '') {
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

                        await this.scanningRepo.processScannedHandleInfo(scannedHandleInfo)
                        if (this.scanningMode == ScanningMode.TIP)
                            await this.handlesRepo.processScannedHandleInfo(scannedHandleInfo)
                    }
                }
            }
        }
        
    };

    private isMintingTransaction = (assetName: string, policyId: string, txBody?: Transaction) : boolean => {
        const assetNameInMintAssets = (txBody?.mint?.[policyId]?.[assetName] ?? 0) > 0;
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
    
    private processRollback = (point: PointOrOrigin, tip: TipOrOrigin) => {
        if (point === 'origin') {
            // this is a rollback to genesis. We need to clear the memory store and start over
            Logger.log(`ROLLBACK POINT: ${JSON.stringify(point)}`);
            this.scanningRepo.rollBackToGenesis();
            if (this.scanningMode == ScanningMode.TIP) {
                this.handlesRepo.rollBackToGenesis();
                this.scanningMode = ScanningMode.BACKFILL;
            }
        } else {
            const { slot, id } = point;
            let lastSlot = 0;
            if (tip !== 'origin') {
                lastSlot = tip.slot;
            }

            // The idea here is we need to rollback all changes from a given slot
            this.scanningRepo.rewindChangesToSlot({ slot, hash: id, lastSlot });
            if (this.scanningMode == ScanningMode.TIP)
                this.handlesRepo.rewindChangesToSlot({ slot, hash: id, lastSlot });
        }
    };
}

export default OgmiosService;