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

const blackListedIpfsCids: string[] = [];

const getDataFromIPFSLink = async (link: string): Promise<any | undefined> => {
    if (!link?.startsWith('ipfs://') || blackListedIpfsCids.includes(link)) return;

    const cid = link.split('ipfs://')[1];
    return decodeCborFromIPFSFile(`${IPFS_GATEWAY}${cid}`);
};

const buildPersonalization = async ({
    personalizationDatum,
    txId,
    index,
    lovelace,
    datumCbor
}: BuildPersonalizationInput): Promise<IPersonalization> => {
    const { portal, designer, socials, vendor } = personalizationDatum;

    const [ipfsPortal, ipfsDesigner, ipfsSocials, ipfsVendor] = await Promise.all(
        [portal, designer, socials, vendor].map(getDataFromIPFSLink)
    );

    let personalization: IPersonalization = {
        reference_token: {
            tx_id: txId,
            index,
            lovelace,
            datum: datumCbor
        },
        validated: true
    };

    if (ipfsDesigner) {
        personalization.designer = ipfsDesigner;
    }

    if (ipfsPortal) {
        personalization.portal = ipfsPortal;
    }

    if (ipfsSocials) {
        personalization.socials = ipfsSocials;
    }

    // add vendor settings
    // if (ipfsVendor) {
    //     personalization.vendor = ipfsVendor;
    // }

    return personalization;
};

function isValidDatum(datumObject: any): boolean {
    // TODO: validate datum
    const { constructor_0 } = datumObject;
    if (
        constructor_0 &&
        Array.isArray(constructor_0) &&
        constructor_0.length === 3 &&
        constructor_0[2].hasOwnProperty('constructor_0')
    ) {
        return true;
    }

    return false;
}

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

    const decodedDatum = await decodeCborToJson(datum);
    const datumObjectConstructor = typeof decodedDatum === 'string' ? JSON.parse(decodedDatum) : decodedDatum;

    if (!isValidDatum(datumObjectConstructor)) {
        Logger.log(`invalid datum for reference token ${hex}`);
        return;
    }

    // TODO: what do we do with the metadata?
    const { constructor_0: datumObject } = datumObjectConstructor;
    const metadata = datumObject[0] as IHandleMetadata;
    const [personalizationDatum] = datumObject[2].constructor_0 as IPzDatum[];

    // populate personalization from the reference token
    const [txId, indexString] = utxo.split('#');
    const index = parseInt(indexString);
    const personalization = await buildPersonalization({
        personalizationDatum,
        txId,
        index,
        lovelace,
        datumCbor: datum
    });

    await HandleStore.savePersonalizationChange({
        hex,
        name,
        personalization,
        addresses: {}, // TODO: get addresses from personalization data
        slotNumber,
        setDefault: personalizationDatum.default ?? false,
        customImage: metadata.image,
        metadata
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

    if (assetName.includes(AssetNameLabel.LABEL_100)) {
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
        const data = handleMetadata && handleMetadata[name];
        const image = data?.image ?? '';
        const og_number = data?.core?.og_number ?? 0;
        const og = !!data?.core?.og;
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

        // Look for burn transactions
        const mintAssets = Object.entries(txBody.body.mint?.assets ?? {});
        for (let i = 0; i < mintAssets.length; i++) {
            const [assetName, value] = mintAssets[i];
            if (assetName.startsWith(policyId) && value === BigInt(-1)) {
                const { name } = getHandleNameFromAssetName(assetName);
                await HandleStore.burnHandle(name, currentSlot);
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
