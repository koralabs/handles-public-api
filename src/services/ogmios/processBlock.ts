import { AssetNameLabel, IHandleMetadata, IPersonalization, IPzDatum } from '@koralabs/handles-public-api-interfaces';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import {
    BlockTip,
    HandleOnChainData,
    MetadataLabel,
    TxBlock,
    TxBlockBody,
    TxBody,
    ProcessAssetTokenInput,
    BuildPersonalizationInput
} from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { buildOnChainObject, getHandleNameFromAssetName } from './utils';
import { IPFS_GATEWAY } from '../../config';
import { decodeCborFromIPFSFile } from '../../utils/ipfs';
import { decodeCborToJson } from '../../utils/cbor';
import { handleDatumSchema } from '../../utils/cbor/schema/handleData';
import { portalSchema } from '../../utils/cbor/schema/portal';
import { designerSchema } from '../../utils/cbor/schema/designer';
import { socialsSchema } from '../../utils/cbor/schema/socials';

const blackListedIpfsCids: string[] = [];

const getDataFromIPFSLink = async ({ link, schema }: { link: string; schema?: any }): Promise<any | undefined> => {
    if (!link?.startsWith('ipfs://') || blackListedIpfsCids.includes(link)) return;

    const cid = link.split('ipfs://')[1];
    return decodeCborFromIPFSFile(`${IPFS_GATEWAY}${cid}`, schema);
};

const buildPersonalization = async ({
    personalizationDatum,
    personalization
}: BuildPersonalizationInput): Promise<IPersonalization> => {
    const { portal, designer, socials, vendor, validated_by, trial, nsfw } = personalizationDatum;

    // start timer for ipfs calls
    const ipfsTimer = Date.now();

    const [ipfsPortal, ipfsDesigner, ipfsSocials, ipfsVendor] = await Promise.all(
        [
            { link: portal, schema: portalSchema },
            { link: designer, schema: designerSchema },
            { link: socials, schema: socialsSchema },
            { link: vendor }
        ].map(getDataFromIPFSLink)
    );

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
        trial: trial === 1,
        nsfw: nsfw === 1
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

export const buildValidDatum = (
    datumObject: any
): { metadata: IHandleMetadata | null; personalizationDatum: IPzDatum | null } => {
    const result = {
        metadata: null,
        personalizationDatum: null
    };

    const { constructor_0 } = datumObject;

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
        version: 0
    };

    const requiredProperties: IPzDatum = {
        standard_image: '',
        portal: '',
        designer: '',
        socials: '',
        vendor: '',
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

    const hasAllRequiredKeys = (object: any, requiredObject: any) =>
        Object.keys(requiredObject).every((key) => Object.keys(object).includes(key));

    if (constructor_0 && Array.isArray(constructor_0) && constructor_0.length === 3) {
        if (hasAllRequiredKeys(constructor_0[0], requiredMetadata)) {
            result.metadata = constructor_0[0];
        }
        if (hasAllRequiredKeys(constructor_0[2], requiredProperties)) {
            result.personalizationDatum = constructor_0[2];
        }
    }

    return result;
};

const buildPersonalizationData = async (datum: string) => {
    const decodedDatum = await decodeCborToJson(datum, handleDatumSchema);
    const datumObjectConstructor = typeof decodedDatum === 'string' ? JSON.parse(decodedDatum) : decodedDatum;

    return buildValidDatum(datumObjectConstructor);
};

const processAssetReferenceToken = async ({
    assetName,
    slotNumber,
    utxo,
    lovelace,
    datum
}: {
    assetName: string;
    slotNumber: number;
    utxo: string;
    lovelace: number;
    datum?: string;
}) => {
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

    let personalization: IPersonalization = {
        reference_token: {
            tx_id: txId,
            index,
            lovelace,
            datum
        },
        validated_by: '',
        trial: true,
        nsfw: true
    };

    const { metadata, personalizationDatum } = await buildPersonalizationData(datum);

    if (!metadata) {
        Logger.log(`invalid metadata for ${hex}`);
        return;
    }

    if (personalizationDatum) {
        // populate personalization from the reference token
        personalization = await buildPersonalization({
            personalizationDatum,
            personalization
        });
    }

    await HandleStore.savePersonalizationChange({
        hex,
        name,
        personalization,
        addresses: {}, // TODO: get other crypto addresses from personalization data
        slotNumber,
        metadata,
        personalizationDatum
    });
};

const processAssetClassToken = async ({
    assetName,
    slotNumber,
    address,
    utxo,
    lovelace,
    datum,
    handleMetadata,
    isMintTx
}: ProcessAssetTokenInput) => {
    if (assetName.includes(AssetNameLabel.LABEL_222)) {
        await processAssetToken({
            assetName,
            slotNumber,
            address,
            utxo,
            lovelace,
            datum,
            handleMetadata,
            isMintTx
        });
        return;
    }

    if (assetName.includes(AssetNameLabel.LABEL_100)) {
        await processAssetReferenceToken({ assetName, slotNumber, utxo, lovelace, datum });
        return;
    }

    if (assetName.includes(AssetNameLabel.LABEL_333)) {
        Logger.log(`FT token found ${assetName}. Not implemented yet`);
        return;
    }

    Logger.log({
        message: `unknown asset name ${assetName}`,
        category: LogCategory.ERROR,
        event: 'processBlock.processAssetClassToken.unknownAssetName'
    });
};

const processAssetToken = async ({
    assetName,
    slotNumber,
    address,
    utxo,
    datum,
    handleMetadata,
    isMintTx
}: ProcessAssetTokenInput) => {
    const { hex, name } = getHandleNameFromAssetName(assetName);

    const input = {
        hex,
        name,
        adaAddress: address,
        slotNumber,
        utxo,
        datum
    };

    if (isMintTx) {
        let image = '';
        let og_number = 0;

        if (assetName.includes(AssetNameLabel.LABEL_222)) {
            const data = handleMetadata && (handleMetadata[hex] as unknown as IHandleMetadata);
            og_number = data?.og_number ?? 0;
            image = data?.image ?? '';
        } else {
            const data = handleMetadata && handleMetadata[name];
            og_number = data?.core?.og_number ?? 0;
            image = data?.image ?? '';
        }

        await HandleStore.saveMintedHandle({
            ...input,
            og_number,
            image
        });
    } else {
        await HandleStore.saveHandleUpdate(input);
    }
};

const isMintingTransaction = (txBody: TxBody, assetName: string) => {
    const result = txBody.body.mint?.assets?.[assetName];
    return result !== undefined;
};

export const processBlock = async ({
    policyId,
    txBlock,
    tip
}: {
    policyId: string;
    txBlock: TxBlock;
    tip: BlockTip;
}) => {
    const startBuildingExec = Date.now();

    const txBlockType = txBlock[Object.keys(txBlock)[0] as 'alonzo' | 'shelley' | 'babbage'] as TxBlockBody;

    const lastSlot = tip.slot;
    const currentSlot = txBlockType?.header?.slot ?? 0;
    const currentBlockHash = txBlockType?.headerHash ?? '';

    HandleStore.setMetrics({ lastSlot, currentSlot, currentBlockHash });

    for (let b = 0; b < txBlockType?.body.length; b++) {
        const txBody = txBlockType?.body[b];
        const txId = txBody?.id;

        // Look for burn transactions
        const mintAssets = Object.entries(txBody.body.mint?.assets ?? {});
        for (let i = 0; i < mintAssets.length; i++) {
            const [assetName, value] = mintAssets[i];
            if (assetName.startsWith(policyId) && value === BigInt(-1)) {
                const { name } = getHandleNameFromAssetName(assetName);
                await HandleStore.burnHandle(name, currentSlot);
            }
        }

        // get metadata so we can use it later
        const handleMetadata =
            txBody.metadata?.body?.blob?.[MetadataLabel.NFT]?.map?.[0]?.k?.string === policyId
                ? buildOnChainObject<HandleOnChainData>(txBody.metadata?.body?.blob?.[MetadataLabel.NFT])
                : null;

        // Iterate through all the outputs and find asset keys that start with our policyId
        for (let i = 0; i < txBody.body.outputs.length; i++) {
            const o = txBody.body.outputs[i];
            if (o.value.assets) {
                const keys = Object.keys(o.value.assets);
                for (let j = 0; j < keys.length; j++) {
                    if (keys[j].toString().startsWith(policyId)) {
                        const assetName = keys[j].toString();
                        const { datum = null } = o;
                        let datumString;
                        try {
                            datumString = !datum
                                ? undefined
                                : typeof datum === 'string'
                                ? datum
                                : JSON.stringify(datum);
                        } catch (error) {
                            Logger.log({
                                message: `Error decoding datum for ${txId}`,
                                category: LogCategory.ERROR,
                                event: 'processBlock.decodingDatum'
                            });
                        }

                        const isMintTx = isMintingTransaction(txBody, assetName);
                        if (assetName === policyId) {
                            // Don't save nameless token.
                            continue;
                        }

                        const data = handleMetadata ? handleMetadata[policyId] : undefined;
                        const {
                            address,
                            value: { coins }
                        } = o;

                        const input: ProcessAssetTokenInput = {
                            assetName,
                            address,
                            slotNumber: currentSlot,
                            utxo: `${txId}#${i}`,
                            lovelace: coins,
                            datum: datumString,
                            handleMetadata: data,
                            isMintTx
                        };

                        if (Object.values(AssetNameLabel).some((v) => assetName.startsWith(`${policyId}.${v}`))) {
                            await processAssetClassToken(input);
                        } else {
                            await processAssetToken(input);
                        }
                    }
                }
            }
        }
    }

    // finish timer for our logs
    const buildingExecFinished = Date.now() - startBuildingExec;
    const { elapsedBuildingExec } = HandleStore.getTimeMetrics();
    HandleStore.setMetrics({
        elapsedBuildingExec: elapsedBuildingExec + buildingExecFinished
    });
};
