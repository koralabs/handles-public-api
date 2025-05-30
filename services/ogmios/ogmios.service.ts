import { createInteractionContext, ensureSocketIsOpen, InteractionContext, safeJSON } from '@cardano-ogmios/client';
import { ChainSynchronizationClient, findIntersection, nextBlock } from '@cardano-ogmios/client/dist/ChainSynchronization';
import { BlockPraos, NextBlockResponse, Ogmios, Point, PointOrOrigin, RollForward, Tip, TipOrOrigin, Transaction } from '@cardano-ogmios/schema';
import { AssetNameLabel, checkNameLabel, HANDLE_POLICIES, HandleType, IHandleMetadata, IHandlesRepository, IPersonalization, IPzDatum, IPzDatumConvertedUsingSchema, LogCategory, Logger, NETWORK, Network } from '@koralabs/kora-labs-common';
import { decodeCborToJson, designerSchema, handleDatumSchema, portalSchema, socialsSchema } from '@koralabs/kora-labs-common/utils/cbor';
import fastq from 'fastq';
import * as url from 'url';
import { OGMIOS_HOST } from '../../config';
import { handleEraBoundaries } from '../../config/constants';
import { BuildPersonalizationInput, HandleOnChainMetadata, MetadataLabel, ProcessOwnerTokenInput } from '../../interfaces/ogmios.interfaces';
import { decodeCborFromIPFSFile } from '../../utils/ipfs';
import { } from '../../utils/util';
import { getHandleNameFromAssetName } from './utils';

let startOgmiosExec = 0;

const blackListedIpfsCids: string[] = [];

class OgmiosService {
    private startTime: number;
    private firstMemoryUsage: number;
    private handlesRepo: IHandlesRepository;
    client?: ChainSynchronizationClient;
    processBlockCallback?: (block: NextBlockResponse) => Promise<void>;

    constructor(handlesRepo: IHandlesRepository, processBlockCallback?: (block: NextBlockResponse) => Promise<void>) {
        this.handlesRepo = new (handlesRepo as any)();
        this.startTime = Date.now();
        this.firstMemoryUsage = process.memoryUsage().rss;
        this.processBlockCallback = processBlockCallback;
    }

    public async initialize() {
        this.handlesRepo.setMetrics({
            currentSlot: handleEraBoundaries[process.env.NETWORK ?? 'preview'].slot,
            currentBlockHash: handleEraBoundaries[process.env.NETWORK ?? 'preview'].id,
            firstSlot: handleEraBoundaries[process.env.NETWORK ?? 'preview'].slot,
            firstMemoryUsage: this.firstMemoryUsage
        });

        const ogmiosUrl = new url.URL(OGMIOS_HOST);

        const context: InteractionContext = await createInteractionContext(
            (err) => console.error(err),
            () => {
                Logger.log({
                    message: 'Connection closed.',
                    category: LogCategory.WARN,
                    event: 'OgmiosService.createInteractionContext.closeHandler'
                });
            },
            {
                connection: {
                    host: ogmiosUrl.hostname,
                    port: parseInt(ogmiosUrl.port)
                }
            }
        );

        this.client = await this.createLocalChainSyncClient(context);
    }

    public async startSync(startingPoint: Point) {
        if (!this.client) {
            throw new Error('Ogmios client is not initialized.');
        }
        
        await this.client.resume(startingPoint.slot == 0 ? ['origin'] : [startingPoint], 1);
        this.handlesRepo.initialize();
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
            const mintAssets = Object.entries(txBody?.mint ?? {});
            for (let i = 0; i < mintAssets.length; i++) {
                const [policy, assetInfo] = mintAssets[i];
                if (HANDLE_POLICIES.contains(NETWORK as Network, policy)) {
                    for (const [assetName, quantity] of Object.entries(assetInfo)) {
                        if (quantity === BigInt(-1)) {
                            const { name } = getHandleNameFromAssetName(assetName);
                            await this.handlesRepo.burnHandle(name, currentSlot);
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
                            // Don't save nameless token.
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

                        const input: ProcessOwnerTokenInput = {
                            assetName,
                            address: o!.address,
                            slotNumber: currentSlot,
                            utxo: `${txId}#${i}`,
                            policy: policyId,
                            lovelace: parseInt(o!.value['ada'].lovelace.toString()),
                            datum: datumString,
                            script,
                            handleMetadata,
                            isMintTx
                        };

                        const { assetLabel } = checkNameLabel(assetName);
                        switch (assetLabel) {
                            case null:
                            case '222':
                                await this.processHandleOwnerToken(input);
                                break;
                            case '100':
                            case '000':
                                await this.processAssetReferenceToken(input);
                                break;
                            case '001':
                                await this.processSubHandleSettingsToken(input);
                                break;
                            default:
                                Logger.log({ message: `unknown asset name ${assetName}`, category: LogCategory.ERROR, event: 'processBlock.processAssetClassToken.unknownAssetName' });
                        }
                    }
                }
            }
        }

        // finish timer for our logs
        const buildingExecFinished = Date.now() - startBuildingExec;
        const { elapsedBuildingExec } = this.handlesRepo.getTimeMetrics();
        this.handlesRepo.setMetrics({ elapsedBuildingExec: elapsedBuildingExec + buildingExecFinished });
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

    private getDataFromIPFSLink = async ({ link, schema }: { link?: string; schema?: any }): Promise<any | undefined> => {
        if (!link?.startsWith('ipfs://') || blackListedIpfsCids.includes(link)) return;

        const cid = link.split('ipfs://')[1];
        return decodeCborFromIPFSFile(`${cid}`, schema);
    };

    private buildPersonalization = async ({ personalizationDatum, personalization }: BuildPersonalizationInput): Promise<IPersonalization> => {
        const { portal, designer, socials, vendor, validated_by, trial, nsfw } = personalizationDatum;

        // start timer for ipfs calls
        const ipfsTimer = Date.now();

        const [ipfsPortal, ipfsDesigner, ipfsSocials] = await Promise.all([{ link: portal, schema: portalSchema }, { link: designer, schema: designerSchema }, { link: socials, schema: socialsSchema }, { link: vendor }].map(this.getDataFromIPFSLink));

        // stop timer for ipfs calls
        const endIpfsTimer = Date.now() - ipfsTimer;
        Logger.log({
            message: `IPFS calls took ${endIpfsTimer}ms`,
            category: LogCategory.INFO,
            event: 'buildPersonalization.ipfsTime'
        });

        const updatedPersonalization: IPersonalization = {
            ...personalization,
            validated_by,
            trial,
            nsfw
        };

        if (ipfsDesigner) {
            updatedPersonalization.designer = ipfsDesigner;
        }

        if (ipfsPortal) {
            updatedPersonalization.portal = ipfsPortal;
        }

        if (ipfsSocials) {
            updatedPersonalization.socials = ipfsSocials;
        }

        // add vendor settings
        // if (ipfsVendor) {
        //     updatedPersonalization.vendor = ipfsVendor;
        // }

        return updatedPersonalization;
    };

    private buildValidDatum = (handle: string, hex: string, datumObject: any): { metadata: IHandleMetadata | null; personalizationDatum: IPzDatumConvertedUsingSchema | null } => {
        const result = {
            metadata: null,
            personalizationDatum: null
        };

        const { constructor_0 } = datumObject;

        const getHandleType = (hex: string): HandleType => {
            if (hex.startsWith(AssetNameLabel.LBL_000)) {
                return HandleType.VIRTUAL_SUBHANDLE;
            }

            if (hex.startsWith(AssetNameLabel.LBL_222) && handle.includes('@')) {
                return HandleType.NFT_SUBHANDLE;
            }

            return HandleType.HANDLE;
        };

        const requiredMetadata: IHandleMetadata = {
            name: '',
            image: '',
            mediaType: '',
            og: 0,
            og_number: 0,
            rarity: '',
            length: 0,
            characters: '',
            numeric_modifiers: '',
            version: 0,
            handle_type: getHandleType(hex)
        };

        const requiredProperties: IPzDatum = {
            standard_image: '',
            default: 0,
            last_update_address: '',
            validated_by: '',
            image_hash: '',
            standard_image_hash: '',
            svg_version: '',
            agreed_terms: '',
            migrate_sig_required: 0,
            trial: 0,
            nsfw: 0
        };

        const getMissingKeys = (object: any, requiredObject: any): string[] =>
            Object.keys(requiredObject).reduce<string[]>((memo, key) => {
                if (!Object.keys(object).includes(key)) {
                    memo.push(key);
                }

                return memo;
            }, []);

        if (constructor_0 && Array.isArray(constructor_0) && constructor_0.length === 3) {
            const missingMetadata = getMissingKeys(constructor_0[0], requiredMetadata);
            if (missingMetadata.length > 0) {
                Logger.log({
                    category: LogCategory.INFO,
                    message: `${handle} missing metadata keys: ${missingMetadata.join(', ')}`,
                    event: 'buildValidDatum.missingMetadata'
                });
            }
            const missingDatum = getMissingKeys(constructor_0[2], requiredProperties);
            if (missingDatum.length > 0) {
                Logger.log({
                    category: LogCategory.INFO,
                    message: `${handle} missing datum keys: ${missingDatum.join(', ')}`,
                    event: 'buildValidDatum.missingDatum'
                });
            }

            return {
                metadata: constructor_0[0],
                personalizationDatum: constructor_0[2]
            };
        }

        Logger.log({
            category: LogCategory.ERROR,
            message: `${handle} invalid metadata: ${JSON.stringify(datumObject)}`,
            event: 'buildValidDatum.invalidMetadata'
        });

        return result;
    };

    private buildPersonalizationData = async (handle: string, hex: string, datum: string) => {
        const decodedDatum = await decodeCborToJson({ cborString: datum, schema: handleDatumSchema });
        const datumObjectConstructor = typeof decodedDatum === 'string' ? JSON.parse(decodedDatum) : decodedDatum;

        return this.buildValidDatum(handle, hex, datumObjectConstructor);
    };

    private processAssetReferenceToken = async ({ assetName, slotNumber, utxo, policy, lovelace, address, datum }: { assetName: string; slotNumber: number; utxo: string; policy: string; lovelace: number; address: string; datum?: string }) => {
        const { hex, name } = getHandleNameFromAssetName(assetName);

        if (!datum) {
            // our reference token should always have datum.
            // If we do not have datum, something is wrong.
            Logger.log({
                message: `no datum for reference token ${assetName}`,
                category: LogCategory.ERROR,
                event: 'processBlock.processAssetReferenceToken.noDatum'
            });
            return;
        }

        const [txId, indexString] = utxo.split('#');
        const index = parseInt(indexString);
        const reference_token = {
            tx_id: txId,
            index,
            lovelace,
            datum,
            address
        };
        let personalization: IPersonalization = {
            validated_by: '',
            trial: true,
            nsfw: true
        };

        const { metadata, personalizationDatum } = await this.buildPersonalizationData(name, hex, datum);

        if (personalizationDatum) {
            // populate personalization from the reference token
            personalization = await this.buildPersonalization({
                personalizationDatum,
                personalization
            });
        }

        await this.handlesRepo.savePersonalizationChange({
            hex,
            name,
            personalization,
            reference_token,
            slotNumber,
            policy,
            metadata,
            personalizationDatum
        });
    };

    private processSubHandleSettingsToken = async ({ assetName, slotNumber, utxo, lovelace, address, datum }: { assetName: string; slotNumber: number; utxo: string; lovelace: number; address: string; datum?: string }) => {
        const { name } = getHandleNameFromAssetName(assetName);

        if (!datum) {
            Logger.log({
                message: `no datum for SubHandle token ${assetName}`,
                category: LogCategory.ERROR,
                event: 'processBlock.processSubHandleSettingsToken.noDatum'
            });
        }

        const [txId, indexString] = utxo.split('#');
        const index = parseInt(indexString);
        const utxoDetails = {
            tx_id: txId,
            index,
            lovelace,
            datum: datum ?? '',
            address
        };

        await this.handlesRepo.saveSubHandleSettingsChange({
            name,
            settingsDatum: datum,
            utxoDetails,
            slotNumber
        });
    };

    private processHandleOwnerToken = async ({ assetName, slotNumber, address, utxo, lovelace, datum, script, handleMetadata, isMintTx, policy }: ProcessOwnerTokenInput) => {
        const { hex, name } = getHandleNameFromAssetName(assetName);
        const isCip68 = assetName.startsWith(AssetNameLabel.LBL_222);
        const data = handleMetadata && (handleMetadata[isCip68 ? hex : name] as unknown as IHandleMetadata);
        const input = {
            hex,
            name,
            adaAddress: address,
            slotNumber,
            utxo,
            lovelace,
            datum,
            script,
            handle_type: name.includes('@') ? HandleType.NFT_SUBHANDLE : HandleType.HANDLE,
            og_number: ((data as any)?.core ?? data)?.og_number ?? 0,
            image: data?.image ?? '',
            version: ((data as any)?.core ?? data)?.version ?? 0,
            sub_characters: data?.sub_characters,
            sub_length: data?.sub_length,
            sub_numeric_modifiers: data?.sub_numeric_modifiers,
            sub_rarity: data?.sub_rarity,
            policy
        };

        if (isMintTx) {
            await this.handlesRepo.saveMintedHandle(input);
            // Do a webhook processor call here
        } else {
            await this.handlesRepo.saveHandleUpdate(input);
        }
    };

    private isMintingTransaction = (assetName: string, policyId: string, txBody?: Transaction) => {
        const assetNameInMintAssets = txBody?.mint?.[policyId]?.[assetName] !== undefined;
        // is CIP67 is false OR is CIP67 is true and label is 222
        const { isCip67, assetLabel } = checkNameLabel(assetName);
        if (isCip67) {
            if (assetLabel === '222') {
                return assetNameInMintAssets;
            }

            return false;
        }

        // not cip68
        return assetNameInMintAssets;
    };
    /**
     * Local Chain Sync client specifically for ADA Handles API.
     *
     * This client's purpose is the make sure we are only working with assets that include the ADA Handle policy ID before we parse the block json.
     *
     * @category ChainSync
     */

    /** @category Constructor */
    private createLocalChainSyncClient = async (context: InteractionContext): Promise<ChainSynchronizationClient> => {
        const { socket } = context;
        return new Promise((resolve) => {
            return resolve({
                context,
                shutdown: async () => {
                    if (socket.CONNECTING || socket.OPEN) {
                        socket.close();
                    }
                },
                resume: async (points) => {
                    Logger.log('Ogmios client resumed.');
                    const intersection = await findIntersection(context, points || [await this.createPointFromCurrentTip(context)]);
                    ensureSocketIsOpen(socket);
                    socket.on('message', async (message: string) => {
                        const response: Ogmios['NextBlockResponse'] = safeJSON.parse(message);
                        if (this.isNextBlockResponse(response)) {
                            await fastq
                                .promise(async (response: Ogmios['NextBlockResponse']) => {
                                    try {
                                        if (response.result.direction == 'forward') {
                                            this.handlesRepo.setMetrics({
                                                currentSlot: ((response.result as RollForward).block as BlockPraos).slot,
                                                currentBlockHash: (response.result as RollForward).block.id,
                                                tipBlockHash: response.result.tip.id,
                                                lastSlot: response.result.tip.slot
                                            });
                                        }
                                        if (response.method === 'nextBlock') {
                                            switch (response.result.direction) {
                                                case 'backward': {
                                                    const { current_slot } = this.handlesRepo.getMetrics();
                                                    Logger.log({
                                                        message: `Rollback ocurred at slot: ${current_slot}. Target point: ${JSON.stringify(response.result.point)}`,
                                                        event: 'OgmiosService.rollBackward',
                                                        category: LogCategory.INFO
                                                    });
                                                    await this.processRollback(response.result.point, response.result.tip);
                                                    break;
                                                }
                                                case 'forward': {
                                                    // finish timer for ogmios rollForward
                                                    const ogmiosExecFinished = startOgmiosExec === 0 ? 0 : Date.now() - startOgmiosExec;
                                                    const { elapsedOgmiosExec } = this.handlesRepo.getTimeMetrics();
                                                    this.handlesRepo.setMetrics({ elapsedOgmiosExec: elapsedOgmiosExec + ogmiosExecFinished });

                                                    if (response.result.block.type !== 'praos') {
                                                        throw new Error(`Block type ${response.result.block.type} is not supported`);
                                                    }

                                                    const block = { txBlock: response.result.block as BlockPraos, tip: response.result.tip as Tip };

                                                    await this.processBlock(block);

                                                    // start timer for ogmios rollForward
                                                    startOgmiosExec = Date.now();
                                                    break;
                                                }
                                                default:
                                                    break;
                                            }
                                        }
                                        if (this.processBlockCallback) await this.processBlockCallback(response);
                                    } catch (error) {
                                        Logger.log({ message: JSON.stringify(error), category: LogCategory.ERROR, event: 'OgmiosClient.Message' });
                                    }
                                }, 1)
                                .push(response);
                        }
                        nextBlock(socket);
                    });

                    nextBlock(socket);
                    return intersection;
                }
            });
        });
    };

    private async createPointFromCurrentTip(context: InteractionContext): Promise<Point> {
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
    private isNextBlockResponse(response: any): response is Ogmios['NextBlockResponse'] {
        return typeof (response as Ogmios['NextBlockResponse'])?.result?.direction !== 'undefined';
    }
}

/** @category ChainSynchronization */
export class TipIsOriginError extends Error {
    public constructor() {
        super();
        this.message = 'Unable to produce point as the chain tip is the origin';
    }
}

export default OgmiosService;
