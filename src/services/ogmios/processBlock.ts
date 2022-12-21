import { IPersonalization } from '@koralabs/handles-public-api-interfaces';
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

const processAssetReferenceToken = async (assetName: string, output: TxOutput) => {
    const hexName = assetName?.split(MetadatumAssetLabel.SUB_STANDARD_NFT)[1];
    if (!hexName) {
        console.log(`unable to decode ${hexName}`, stringifyBlock(output));
        return;
    }

    // TODO: get the metadata from the datum
    const referenceTokenData = buildOnChainObject<PersonalizationOnChainMetadata>(output.datum);
    if (!referenceTokenData) return;

    // populate personalization from the reference token
    const personalization = await buildPersonalization(referenceTokenData);

    // TODO: get addresses from personalization data
    await HandleStore.savePersonalizationChange({ hexName, personalization, addresses: {} });
};

const processAssetToken = async (
    assetName: string,
    address: string,
    handleMetadata?: { [handleName: string]: HandleOnChainMetadata }
) => {
    const hexName = assetName?.split('.')[1];
    if (!hexName) {
        console.log(`unable to decode ${hexName}`, stringifyBlock(address));
        return;
    }

    const name = Buffer.from(hexName, 'hex').toString('utf8');
    const data = handleMetadata && handleMetadata[name];

    if (data) {
        const {
            image,
            core: { og }
        } = data;
        await HandleStore.saveMintedHandle({ hexName, name, og, image, adaAddress: address });
    } else {
        await HandleStore.saveWalletAddressMove(hexName, address);
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

    for (let b=0; b<txBlockType?.body.length; b++) {
        const txBody = txBlockType?.body[b];
        // get metadata so we can use it later when we need to get OG data.
        const handleMetadata =
            txBody.metadata?.body?.blob?.[MetadataLabel.NFT]?.map?.[0]?.k?.string === policyId
                ? buildOnChainObject<HandleOnChainData>(txBody.metadata?.body?.blob?.[MetadataLabel.NFT])
                : null;

        // const filteredOutputs = txBody.body.outputs.filter((o) =>
        //     Object.keys(o.value.assets ?? {}).some((a) => a.startsWith(policyId))
        // );

        for (let i = 0; i < txBody.body.outputs.length; i++) {
            const o = txBody.body.outputs[i];
            if (o.value.assets) {
                const keys = Object.keys(o.value.assets);
                for (let j = 0; j < keys.length; j++) {
                    if (keys[j].toString().startsWith(policyId)) {
                        const assetName = keys[j].toString();
                        if (assetName.startsWith(`${policyId}${MetadatumAssetLabel.REFERENCE_NFT}`)) {
                            await processAssetReferenceToken(assetName, o);
                        }
                        else
                        {
                            const data = isMintingTransaction(txBody, assetName) && handleMetadata ? handleMetadata[policyId] : undefined;
                            const { address } = o;
                            await processAssetToken(assetName, address, data);
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
