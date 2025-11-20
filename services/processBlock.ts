import { BlockPraos, Transaction } from "@cardano-ogmios/schema";
import { AssetNameLabel, checkNameLabel, HANDLE_POLICIES, LogCategory, Logger, NETWORK, Network } from "@koralabs/kora-labs-common";
import { HandleOnChainMetadata, MetadataLabel, ScannedHandleInfo } from "../interfaces/ogmios.interfaces";
import { HandlesRepository } from "../repositories/handlesRepository";
import { getHandleNameFromAssetName } from "./ogmios/utils";

export const processBlock = async (txBlock: BlockPraos, repo: HandlesRepository) => {
    const currentSlot = txBlock?.slot ?? repo.getMetrics().currentSlot ?? 0;
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
                            const handle = repo.getHandle(name);
                            if (!handle) continue;
                            repo.removeHandle(handle, currentSlot);
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
                    const isMintTx = isMintingTransaction(assetName, policyId, txBody);
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
                    await repo.processScannedHandleInfo(scannedHandleInfo)
                }
            }
        }
    }
    
};

export const isMintingTransaction = (assetName: string, policyId: string, txBody?: Transaction) : boolean => {
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