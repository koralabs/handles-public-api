import { BlockPraos } from "@cardano-ogmios/schema";
import { AssetNameLabel, HANDLE_POLICIES, LogCategory, Logger, NETWORK, Network } from "@koralabs/kora-labs-common";
import { UTxO } from "../interfaces/ogmios.interfaces";
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
            if (values.length) {
                const minted = Object.entries(txBody?.mint ?? {}).filter(([policyId]) => HANDLE_POLICIES.contains(NETWORK as Network, policyId));
                const handleAssets: [string, string[]][] = values.map(([policy, handles]) => [policy, Object.keys(handles),]);
                const handles = handleAssets.flatMap(h => h[1])
                const mintAssets: [string, string[]][] = minted.map(([policy, handles]) => [policy, Object.keys(handles).filter(k => handles[k] > 0n),]);
                const metadata = Object.fromEntries(
                    Object.entries(txBody?.metadata ?? {}).filter(([label]) => label == '721') // We only need 721 label
                    .map(([label, labelObj]) => {
                        const { version, ...policies } = labelObj as any;
                        const filteredPolicies = Object.fromEntries(
                            Object.entries(policies)
                            .filter(([policyId]) => HANDLE_POLICIES.contains(NETWORK as Network, policyId))
                            .map(([policyId, assets]) => {
                                // Only handles in this UTxO
                                const filteredAssets = Object.fromEntries(Object.entries(assets as any).filter(([assetName]) => handleAssets.includes(assetName)));
                                return [policyId, filteredAssets];
                            })
                            .filter(([, assets]) => Object.keys(assets as any).length > 0)
                        );

                        return [label, { ...filteredPolicies, ...(version && { version }) }];
                    })
                    // drop labels that ended up with no assets under any policyId
                    .filter(([, labelObj]) => Object.keys(labelObj as any).some(k => k !== "version"))
                )
                // We need to get the datum. This can either be a string or json object.
                let datum;
                try {
                    datum = !o?.datum ? undefined : typeof o?.datum === 'string' ? o?.datum : JSON.stringify(o?.datum);
                } catch {
                    Logger.log({ message: `Error decoding datum for ${txId}#${i}`, category: LogCategory.ERROR, event: 'processBlock.decodingDatum' });
                }
                // extract handle related UTxO information
                const utxo: UTxO = {
                    id: `${txId}#${i}`,
                    slot: currentSlot,
                    address: o?.address!,
                    lovelace: Number(o?.value!.ada.lovelace!),
                    datum,
                    script: o?.script?.cbor ? {
                        type: o?.script?.language.replace(':', '_'),
                        cbor: o?.script?.cbor
                    } : undefined,
                    handles: handleAssets,
                    mint: mintAssets, // filtered for the minted assets in this UTxO
                    metadata // filtered for the minted assets in this UTxO
                }

                // save UTxO to repo
                await repo.addUTxO(utxo);
                await repo.updateHandleIndexes(utxo); // be sure to include mint:handle index {created_slot, metadata, txhashes}
                // Create two separate valkey instances, one for UTxOs/mints and the other for
            }
        }
        // remove all the utxos that were spent as inputs to this tx
        await repo.removeUTxOs(txBody?.inputs.flatMap((x) => `${x.transaction.id}#${x.index}`))
    }
    
};
