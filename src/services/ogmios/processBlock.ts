import { IHandle } from '../../interfaces/handle.interface';
import {
    BlockTip,
    HandleOnChainData,
    HandleOnChainMetadata,
    TxBlock,
    TxBlockBody
} from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import {
    buildCharacters,
    buildHandleMetadata,
    buildNumericModifiers,
    getRarity,
    hex2String,
    stringifyBlock
} from './utils';

export const buildHandle = ({
    hexName,
    name,
    adaAddress,
    data
}: {
    hexName: string;
    name: string;
    adaAddress: string;
    data: HandleOnChainMetadata | null;
}) => {
    // If there is already a handle in the map, we just need to update the address and add it back to the list
    const existingHandle = HandleStore.get(hexName);
    if (existingHandle) {
        existingHandle.resolved_addresses.ada = adaAddress;
        HandleStore.save(existingHandle);
        return;
    }

    // otherwise, we need to get the minting transaction and populate the metadata
    const newHandle: IHandle = {
        hex: hexName,
        name,
        length: name.length,
        rarity: getRarity(name),
        characters: buildCharacters(name),
        numeric_modifiers: buildNumericModifiers(name),
        resolved_addresses: {
            ada: adaAddress
        },
        personalization: {},

        // metadata info
        og: data?.core?.og ?? 0,
        nft_image: data?.image ?? '',
        original_nft_image: data?.image ?? ''
    };

    HandleStore.save(newHandle);
};

export const processBlock = ({ policyId, txBlock, tip }: { policyId: string; txBlock: TxBlock; tip: BlockTip }) => {
    const startBuildingExec = Date.now();

    const blockType = txBlock[Object.keys(txBlock)[0] as 'alonzo' | 'shelley' | 'babbage'] as TxBlockBody;

    const lastSlot = tip.slot;
    const currentSlot = blockType?.header?.slot ?? 0;
    const currentBlockHash = blockType?.headerHash ?? '';

    HandleStore.setMetrics({ lastSlot, currentSlot, currentBlockHash });

    blockType?.body.forEach((blockBody) => {
        // get metadata so we can use it later when we need to get OG data.
        const handleMetadata =
            blockBody.metadata?.body?.blob?.[721]?.map?.[0]?.k?.string === policyId
                ? buildHandleMetadata(blockBody.metadata?.body?.blob)
                : null;

        blockBody.body.outputs
            .filter((o) => Object.keys(o.value.assets ?? {}).some((a) => a.startsWith(policyId)))
            .forEach((output) => {
                Object.keys(output.value.assets ?? {})
                    .filter((a) => a.startsWith(policyId))
                    .forEach((policyIdDotHexName) => {
                        const hexName = policyIdDotHexName?.split('.')[1];
                        if (!hexName) {
                            console.log(`unable to decode ${hexName}`, stringifyBlock(output));
                            return;
                        }

                        const name = hex2String(hexName);
                        const data =
                            blockBody.body.mint?.assets?.[policyIdDotHexName] && handleMetadata
                                ? handleMetadata[policyId][name]
                                : null;

                        buildHandle({ hexName, name, adaAddress: output.address, data });
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
