import { IPersonalization } from '../../interfaces/handle.interface';
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

    HandleStore.savePersonalizationChange({ hexName, personalization });
};

const processAssetToken = (
    assetName: string,
    output: TxOutput,
    handleMetadata?: { [handleName: string]: HandleOnChainMetadata }
) => {
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
        HandleStore.saveMintedHandle({ hexName, name, og, image, adaAddress: output.address });
    } else {
        HandleStore.saveWalletAddressMove(hexName, output.address);
    }
};

const isMintingTransaction = (txBody: TxBody, assetName: string) => {
    const result = txBody.body.mint?.assets?.[assetName];
    return result !== undefined;
};

export const processBlock = ({ policyId, txBlock, tip }: { policyId: string; txBlock: TxBlock; tip: BlockTip }) => {
    const startBuildingExec = Date.now();

    const txBlockType = txBlock[Object.keys(txBlock)[0] as 'alonzo' | 'shelley' | 'babbage'] as TxBlockBody;

    const lastSlot = tip.slot;
    const currentSlot = txBlockType?.header?.slot ?? 0;
    const currentBlockHash = txBlockType?.headerHash ?? '';

    HandleStore.setMetrics({ lastSlot, currentSlot, currentBlockHash });

    txBlockType?.body.forEach((txBody) => {
        // get metadata so we can use it later when we need to get OG data.
        const handleMetadata =
            txBody.metadata?.body?.blob?.[MetadataLabel.NFT]?.map?.[0]?.k?.string === policyId
                ? buildOnChainObject<HandleOnChainData>(txBody.metadata?.body?.blob?.[MetadataLabel.NFT])
                : null;

        txBody.body.outputs
            .filter((o) => Object.keys(o.value.assets ?? {}).some((a) => a.startsWith(policyId)))
            .forEach((output) => {
                Object.keys(output.value.assets ?? {})
                    .filter((a) => a.startsWith(policyId))
                    .forEach(async (assetName) => {
                        // assetName can be:
                        //  - {policyId}.{assetNameHex}
                        //  - {policyId}{asset_name}{assetNameHex}

                        if (assetName.startsWith(`${policyId}${MetadatumAssetLabel.SUB_STANDARD_NFT}`)) {
                            await processAssetReferenceToken(assetName, output);
                            return;
                        }

                        const data =
                            isMintingTransaction(txBody, assetName) && handleMetadata
                                ? handleMetadata[policyId]
                                : undefined;
                        processAssetToken(assetName, output, data);
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
