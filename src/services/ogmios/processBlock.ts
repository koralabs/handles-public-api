import { IPersonalization } from '@koralabs/handles-public-api-interfaces';
import { Logger } from '@koralabs/kora-labs-common';
import {
    BlockTip,
    HandleOnChainData,
    HandleOnChainMetadata,
    MetadataLabel,
    MetadatumAssetLabel,
    PersonalizationOnChainMetadata,
    TxBlock,
    TxBlockBody,
    TxBody,
    TxOutput
} from '../../interfaces/ogmios.interfaces';
import { Buffer } from 'buffer';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { awaitForEach } from '../../utils/util';
import { buildOnChainObject, stringifyBlock } from './utils';

const buildPersonalization = async (metadata: PersonalizationOnChainMetadata): Promise<IPersonalization> => {
    const { personalContactInfo, additionalHandleSettings, socialContactInfo } = metadata;
    const [personal, settings, social] = await Promise.all(
        [personalContactInfo, additionalHandleSettings, socialContactInfo].map((link) => {
            // TODO: fetch details from ipfs
        })
    );

    const personalization: IPersonalization = {};

    return personalization;
};

const processAssetReferenceToken = async ({
    assetName,
    slotNumber,
    datum
}: {
    assetName: string;
    slotNumber: number;
    datum:
        | string
        | {
              [k: string]: unknown;
          }
        | null
        | undefined;
}) => {
    const hexName = assetName?.split(MetadatumAssetLabel.SUB_STANDARD_NFT)[1];
    if (!hexName) {
        Logger.log(`unable to decode ${hexName}`);
        return;
    }

    // TODO: get the metadata from the datum
    const referenceTokenData = buildOnChainObject<PersonalizationOnChainMetadata>(datum);
    if (!referenceTokenData) return;

    // populate personalization from the reference token
    const personalization = await buildPersonalization(referenceTokenData);

    // TODO: get addresses from personalization data
    await HandleStore.savePersonalizationChange({
        hexName,
        personalization,
        addresses: {},
        slotNumber,
        hasDatum: !!datum
    });
};

const processAssetToken = async ({
    assetName,
    slotNumber,
    address,
    utxo,
    hasDatum,
    handleMetadata
}: {
    assetName: string;
    slotNumber: number;
    address: string;
    utxo: string;
    hasDatum: boolean;
    handleMetadata?: { [handleName: string]: HandleOnChainMetadata };
}) => {
    const hexName = assetName?.split('.')[1];
    if (!hexName) {
        Logger.log(`unable to decode ${hexName}`);
        return;
    }

    const name = Buffer.from(hexName, 'hex').toString('utf8');
    const data = handleMetadata && handleMetadata[name];

    if (data) {
        const {
            image,
            core: { og }
        } = data;
        await HandleStore.saveMintedHandle({
            hexName,
            name,
            og,
            image,
            slotNumber,
            utxo,
            hasDatum,
            adaAddress: address
        });
    } else {
        await HandleStore.saveHandleUpdate({ hexName, adaAddress: address, slotNumber, utxo, hasDatum });
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

                        if (assetName.startsWith(`${policyId}${MetadatumAssetLabel.REFERENCE_NFT}`)) {
                            await processAssetReferenceToken({ assetName, slotNumber: currentSlot, datum });
                        } else {
                            const data =
                                isMintingTransaction(txBody, assetName) && handleMetadata
                                    ? handleMetadata[policyId]
                                    : undefined;
                            const { address } = o;
                            await processAssetToken({
                                assetName,
                                address,
                                slotNumber: currentSlot,
                                hasDatum: !!datum,
                                handleMetadata: data,
                                utxo: `${txId}#${i}`
                            });
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
