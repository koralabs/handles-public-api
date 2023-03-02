import { IPersonalization } from '@koralabs/handles-public-api-interfaces';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import {
    BlockTip,
    HandleOnChainData,
    MetadataLabel,
    MetadatumAssetLabel,
    PersonalizationDatum,
    TxBlock,
    TxBlockBody,
    TxBody,
    ProcessAssetTokenInput
} from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { buildOnChainObject, getHandleNameFromAssetName } from './utils';
import { decodeDatum } from '../../utils/serialization';
import { IPFS_GATEWAY } from '../../config';
import { decodeCborFromIPFSFile } from '../../utils/ipfs';

const blackListedIpfsCids: string[] = [];

const getDataFromIPFSLink = async (link: string): Promise<any | undefined> => {
    if (!link?.startsWith('ipfs://') || blackListedIpfsCids.includes(link)) return;

    const cid = link.split('ipfs://')[1];
    return decodeCborFromIPFSFile(`${IPFS_GATEWAY}${cid}`);
};

const buildPersonalization = async (datum: PersonalizationDatum): Promise<IPersonalization> => {
    const { portal, designer, socials, vendor } = datum;
    const [ipfsPortal, ipfsDesigner, ipfsSocials, ipfsVendor] = await Promise.all(
        [portal, designer, socials, vendor].map(getDataFromIPFSLink)
    );

    let personalization: IPersonalization = {};

    if (ipfsDesigner) {
        personalization.nft_appearance = ipfsDesigner;
    }

    if (ipfsPortal) {
        personalization.my_page = ipfsPortal;
    }

    if (ipfsSocials) {
        personalization.social_links = ipfsSocials;
    }

    // add vendor settings
    // if (ipfsVendor) {
    //     personalization.vendor = ipfsVendor;
    // }

    return personalization;
};

function isValidDatum(datumObject: any): boolean {
    // TODO: validate datum
    if (Array.isArray(datumObject) && datumObject.length === 3) {
        return true;
    }

    return false;
}

const processAssetReferenceToken = async ({
    assetName,
    slotNumber,
    datum
}: {
    assetName: string;
    slotNumber: number;
    datum?: string;
}) => {
    const { hex, name } = getHandleNameFromAssetName(assetName);

    if (!datum) {
        // our reference token should always have datum.
        // If we do not have datum, something is wrong.
        // TODO: what happens during a token burn?
        Logger.log({
            message: `no datum for reference token ${assetName}`,
            category: LogCategory.ERROR,
            event: 'processBlock.processAssetReferenceToken.noDatum'
        });
        return;
    }

    const decodedDatum = decodeDatum(datum);
    const datumObject = typeof decodedDatum === 'string' ? JSON.parse(decodedDatum) : decodedDatum;

    if (!isValidDatum(datumObject)) {
        Logger.log(`invalid datum for reference token ${assetName}`);
        return;
    }

    const metadata = datumObject[0];
    const personalizationData = datumObject[2] as PersonalizationDatum;

    // populate personalization from the reference token
    const personalization = await buildPersonalization(personalizationData);

    // TODO: get addresses from personalization data
    await HandleStore.savePersonalizationChange({
        hex,
        name,
        personalization,
        addresses: {},
        slotNumber,
        setDefault: personalizationData.default,
        customImage: personalizationData.custom_image
    });
};

const processAssetClassToken = async ({
    assetName,
    slotNumber,
    address,
    utxo,
    datum,
    handleMetadata,
    isMintTx
}: ProcessAssetTokenInput) => {
    if (assetName.includes(MetadatumAssetLabel.SUB_STANDARD_NFT)) {
        await processAssetToken({
            assetName,
            slotNumber,
            address,
            utxo,
            datum,
            handleMetadata,
            isMintTx
        });
        return;
    }

    if (assetName.includes(MetadatumAssetLabel.REFERENCE_NFT)) {
        await processAssetReferenceToken({ assetName, slotNumber, datum });
        return;
    }

    if (assetName.includes(MetadatumAssetLabel.SUB_STANDARD_FT)) {
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
        const og = data?.core?.og ?? 0;
        await HandleStore.saveMintedHandle({
            ...input,
            og,
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
        // get metadata so we can use it later when we need to get OG data.
        const handleMetadata =
            txBody.metadata?.body?.blob?.[MetadataLabel.NFT]?.map?.[0]?.k?.string === policyId
                ? buildOnChainObject<HandleOnChainData>(txBody.metadata?.body?.blob?.[MetadataLabel.NFT])
                : null;

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
                        const { address } = o;

                        const input: ProcessAssetTokenInput = {
                            assetName,
                            address,
                            slotNumber: currentSlot,
                            utxo: `${txId}#${i}`,
                            datum: datumString,
                            handleMetadata: data,
                            isMintTx
                        };

                        if (Object.values(MetadatumAssetLabel).some((v) => assetName.startsWith(`${policyId}.${v}`))) {
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
