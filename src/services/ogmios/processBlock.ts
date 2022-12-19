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
import { buildOnChainObject, hex2String, stringifyBlock } from './utils';

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
    output,
    slotNumber
}: {
    assetName: string;
    output: TxOutput;
    slotNumber: number;
}) => {
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
    await HandleStore.savePersonalizationChange({ hexName, personalization, addresses: {}, slotNumber });
};

const processAssetToken = async ({
    assetName,
    slotNumber,
    output,
    handleMetadata
}: {
    assetName: string;
    slotNumber: number;
    output: TxOutput;
    handleMetadata?: { [handleName: string]: HandleOnChainMetadata };
}) => {
    const hexName = assetName?.split('.')[1];
    if (!hexName) {
        console.log(`unable to decode ${hexName}`, stringifyBlock(output));
        return;
    }

    const name = hex2String(hexName);
    const data = handleMetadata && handleMetadata[name];

    if (data) {
        const {
            image,
            core: { og }
        } = data;
        await HandleStore.saveMintedHandle({ hexName, name, og, image, slotNumber, adaAddress: output.address });
    } else {
        await HandleStore.saveWalletAddressMove({ hexName, adaAddress: output.address, slotNumber });
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

    await awaitForEach(txBlockType?.body, async (txBody) => {
        // get metadata so we can use it later when we need to get OG data.
        const handleMetadata =
            txBody.metadata?.body?.blob?.[MetadataLabel.NFT]?.map?.[0]?.k?.string === policyId
                ? buildOnChainObject<HandleOnChainData>(txBody.metadata?.body?.blob?.[MetadataLabel.NFT])
                : null;

        const filteredOutputs = txBody.body.outputs.filter((o) =>
            Object.keys(o.value.assets ?? {}).some((a) => a.startsWith(policyId))
        );

        await awaitForEach(filteredOutputs, async (output) => {
            const filteredAssets = Object.keys(output.value.assets ?? {}).filter((a) => a.startsWith(policyId));

            await awaitForEach(filteredAssets, async (assetName) => {
                // assetName can be:
                //  - {policyId}.{assetNameHex}
                //  - {policyId}{asset_name}{assetNameHex}

                if (assetName.startsWith(`${policyId}${MetadatumAssetLabel.SUB_STANDARD_NFT}`)) {
                    await processAssetReferenceToken({ assetName, output, slotNumber: currentSlot });
                    return;
                }

                const data =
                    isMintingTransaction(txBody, assetName) && handleMetadata ? handleMetadata[policyId] : undefined;
                await processAssetToken({ assetName, slotNumber: currentSlot, output, handleMetadata: data });
            });
        });
    });

    // finish timer for our logs
    const buildingExecFinished = Date.now() - startBuildingExec;
    const { elapsedBuildingExec } = HandleStore.getTimeMetrics();
    HandleStore.setMetrics({
        elapsedBuildingExec: elapsedBuildingExec + buildingExecFinished
    });
};
