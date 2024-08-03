import { AssetNameLabel, HandleType, IHandleMetadata, IPersonalization, IPzDatum, ISubHandleSettingsDatumStruct } from '@koralabs/kora-labs-common';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import { designerSchema, handleDatumSchema, portalSchema, socialsSchema, subHandleSettingsDatumSchema, decodeCborToJson } from '@koralabs/kora-labs-common/utils/cbor';
import { HandleOnChainData, MetadataLabel, TxBlock, TxBlockBody, TxBody, ProcessAssetTokenInput, BuildPersonalizationInput, HandleOnChainMetadata } from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { buildOnChainObject, getHandleNameFromAssetName, stringifyBlock } from './utils';
import { decodeCborFromIPFSFile } from '../../utils/ipfs';
import { checkNameLabel } from '../../utils/util';
import { Block, BlockPraos, StringNoSchema, Tip, Transaction } from '@cardano-ogmios/schema';

const blackListedIpfsCids: string[] = [];

const getDataFromIPFSLink = async ({ link, schema }: { link?: string; schema?: any }): Promise<any | undefined> => {
    if (!link?.startsWith('ipfs://') || blackListedIpfsCids.includes(link)) return;

    const cid = link.split('ipfs://')[1];
    return decodeCborFromIPFSFile(`${cid}`, schema);
};

const buildPersonalization = async ({ personalizationDatum, personalization }: BuildPersonalizationInput): Promise<IPersonalization> => {
    const { portal, designer, socials, vendor, validated_by, trial, nsfw } = personalizationDatum;

    // start timer for ipfs calls
    const ipfsTimer = Date.now();

    const [ipfsPortal, ipfsDesigner, ipfsSocials, ipfsVendor] = await Promise.all([{ link: portal, schema: portalSchema }, { link: designer, schema: designerSchema }, { link: socials, schema: socialsSchema }, { link: vendor }].map(getDataFromIPFSLink));

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

export const buildValidDatum = (handle: string, hex: string, datumObject: any): { metadata: IHandleMetadata | null; personalizationDatum: IPzDatum | null } => {
    const result = {
        metadata: null,
        personalizationDatum: null
    };

    const { constructor_0 } = datumObject;

    const getHandleType = (hex: string): HandleType => {
        if (hex.startsWith(AssetNameLabel.LBL_000)) {
            return HandleType.VIRTUAL_SUBHANDLE;
        }

        if (hex.startsWith(AssetNameLabel.LBL_222) && handle.includes('@')) {
            return HandleType.NFT_SUBHANDLE;
        }

        return HandleType.HANDLE;
    };

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
        version: 0,
        handle_type: getHandleType(hex)
    };

    const requiredProperties: IPzDatum = {
        standard_image: '',
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

    const getMissingKeys = (object: any, requiredObject: any): string[] =>
        Object.keys(requiredObject).reduce<string[]>((memo, key) => {
            if (!Object.keys(object).includes(key)) {
                memo.push(key);
            }

            return memo;
        }, []);

    if (constructor_0 && Array.isArray(constructor_0) && constructor_0.length === 3) {
        const missingMetadata = getMissingKeys(constructor_0[0], requiredMetadata);
        if (missingMetadata.length > 0) {
            Logger.log({
                category: LogCategory.INFO,
                message: `${handle} missing metadata keys: ${missingMetadata.join(', ')}`,
                event: 'buildValidDatum.missingMetadata'
            });
        }
        const missingDatum = getMissingKeys(constructor_0[2], requiredProperties);
        if (missingDatum.length > 0) {
            Logger.log({
                category: LogCategory.INFO,
                message: `${handle} missing datum keys: ${missingDatum.join(', ')}`,
                event: 'buildValidDatum.missingDatum'
            });
        }

        return {
            metadata: constructor_0[0],
            personalizationDatum: constructor_0[2]
        };
    }

    Logger.log({
        category: LogCategory.ERROR,
        message: `${handle} invalid metadata: ${JSON.stringify(datumObject)}`,
        event: 'buildValidDatum.invalidMetadata'
    });

    return result;
};

const buildPersonalizationData = async (handle: string, hex: string, datum: string) => {
    const decodedDatum = await decodeCborToJson({ cborString: datum, schema: handleDatumSchema });
    const datumObjectConstructor = typeof decodedDatum === 'string' ? JSON.parse(decodedDatum) : decodedDatum;

    return buildValidDatum(handle, hex, datumObjectConstructor);
};

const processAssetReferenceToken = async ({ assetName, slotNumber, utxo, lovelace, address, datum }: { assetName: string; slotNumber: number; utxo: string; lovelace: number; address: string; datum?: string }) => {
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
    let reference_token = {
        tx_id: txId,
        index,
        lovelace,
        datum,
        address
    };
    let personalization: IPersonalization = {
        validated_by: '',
        trial: true,
        nsfw: true
    };

    const { metadata, personalizationDatum } = await buildPersonalizationData(name, hex, datum);

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
        reference_token,
        slotNumber,
        metadata,
        personalizationDatum
    });
};

const processSubHandleSettingsToken = async ({ assetName, slotNumber, utxo, lovelace, address, datum }: { assetName: string; slotNumber: number; utxo: string; lovelace: number; address: string; datum?: string }) => {
    const { name } = getHandleNameFromAssetName(assetName);

    if (!datum) {
        Logger.log({
            message: `no datum for SubHandle token ${assetName}`,
            category: LogCategory.ERROR,
            event: 'processBlock.processSubHandleSettingsToken.noDatum'
        });
    }

    const [txId, indexString] = utxo.split('#');
    const index = parseInt(indexString);
    const utxoDetails = {
        tx_id: txId,
        index,
        lovelace,
        datum: datum ?? '',
        address
    };

    await HandleStore.saveSubHandleSettingsChange({
        name,
        settingsDatum: datum,
        utxoDetails,
        slotNumber
    });
};

const processAssetClassToken = async ({ assetName, slotNumber, address, utxo, lovelace, datum, script, handleMetadata, isMintTx }: ProcessAssetTokenInput) => {
    if (assetName.includes(AssetNameLabel.LBL_222)) {
        await processAssetToken({
            assetName,
            slotNumber,
            address,
            utxo,
            lovelace,
            datum,
            script,
            handleMetadata,
            isMintTx
        });
        return;
    }

    if (assetName.includes(AssetNameLabel.LBL_100) || assetName.includes(AssetNameLabel.LBL_000)) {
        await processAssetReferenceToken({ assetName, slotNumber, utxo, lovelace, address, datum });
        return;
    }

    if (assetName.includes('00001070')) {
        await processSubHandleSettingsToken({ assetName, slotNumber, utxo, lovelace, address, datum });
        return;
    }

    Logger.log({
        message: `unknown asset name ${assetName}`,
        category: LogCategory.ERROR,
        event: 'processBlock.processAssetClassToken.unknownAssetName'
    });
};

const processAssetToken = async ({ assetName, slotNumber, address, utxo, datum, script, handleMetadata, isMintTx }: ProcessAssetTokenInput) => {
    const { hex, name } = getHandleNameFromAssetName(assetName);

    const input = {
        hex,
        name,
        adaAddress: address,
        slotNumber,
        utxo,
        datum,
        script,
        handle_type: name.includes('@') ? HandleType.NFT_SUBHANDLE : HandleType.HANDLE
    };

    if (isMintTx) {
        let image = '';
        let og_number = 0;
        let version = 0;
        let sub_characters;
        let sub_length;
        let sub_numeric_modifiers;
        let sub_rarity;

        if (assetName.includes(AssetNameLabel.LBL_222)) {
            const data = handleMetadata && (handleMetadata[hex] as unknown as IHandleMetadata);
            og_number = data?.og_number ?? 0;
            image = data?.image ?? '';
            version = data?.version ?? 0;
            sub_characters = data?.sub_characters;
            sub_length = data?.sub_length;
            sub_numeric_modifiers = data?.sub_numeric_modifiers;
            sub_rarity = data?.sub_rarity;
        } else {
            const data = handleMetadata && handleMetadata[name];
            og_number = data?.core?.og_number ?? 0;
            image = data?.image ?? '';
            version = data?.core?.version ?? 0;
        }

        await HandleStore.saveMintedHandle({
            ...input,
            og_number,
            image,
            version,
            sub_characters,
            sub_length,
            sub_numeric_modifiers,
            sub_rarity
        });
        // Do a webhook processor call here
    } else {
        await HandleStore.saveHandleUpdate(input);
    }
};

const isMintingTransaction = (assetName: string, policyId: string, txBody?: Transaction) => {
    const assetNameInMintAssets = txBody?.mint?.[policyId]?.[assetName] !== undefined;
    // is CIP67 is false OR is CIP67 is true and label is 222
    const { isCip67, assetLabel } = checkNameLabel(assetName);
    if (isCip67) {
        if (assetLabel === '222') {
            return assetNameInMintAssets;
        }

        return false;
    }

    // not cip68
    return assetNameInMintAssets;
};

export const processBlock = async ({ policyId, txBlock, tip }: { policyId: string; txBlock: BlockPraos; tip: Tip }) => {
    const startBuildingExec = Date.now();

    const lastSlot = tip.slot;
    const currentSlot = txBlock?.slot ?? 0;
    const currentBlockHash = txBlock.id ?? '0';
    const tipBlockHash = tip?.id ?? '1';

    HandleStore.setMetrics({ lastSlot, currentSlot, currentBlockHash, tipBlockHash });

    for (let b = 0; b < (txBlock?.transactions ?? []).length; b++) {
        const txBody = txBlock?.transactions?.[b];
        const txId = txBody?.id;

        // Look for burn transactions
        const mintAssets = Object.entries(txBody?.mint ?? {});
        for (let i = 0; i < mintAssets.length; i++) {
            const [policy, assetInfo] = mintAssets[i];
            if (policy === policyId) {
                const [assetName, quantity] = Object.entries(assetInfo)[0];
                if (quantity === BigInt(-1)) {
                    const { name } = getHandleNameFromAssetName(assetName);
                    await HandleStore.burnHandle(name, currentSlot);
                }
            }
        }

        // get metadata so we can use it later
        const handleMetadata: { [handleName: string]: HandleOnChainMetadata } | undefined = (txBody?.metadata?.labels?.[MetadataLabel.NFT]?.json as any)?.[policyId];

        // Iterate through all the outputs and find asset keys that start with our policyId
        for (let i = 0; i < (txBody?.outputs ?? []).length; i++) {
            const o = txBody?.outputs[i];
            const asset = o?.value?.[policyId];
            if (asset) {
                const assetName = Object.keys(asset)[0];
                const { datum = null, script: outputScript } = o;

                // We need to get the datum. This can either be a string or json object.
                let datumString;
                try {
                    datumString = !datum ? undefined : typeof datum === 'string' ? datum : JSON.stringify(datum);
                } catch (error) {
                    Logger.log({
                        message: `Error decoding datum for ${txId}`,
                        category: LogCategory.ERROR,
                        event: 'processBlock.decodingDatum'
                    });
                }

                const isMintTx = isMintingTransaction(assetName, policyId, txBody);
                if (assetName === policyId) {
                    // Don't save nameless token.
                    continue;
                }

                let script: { type: string; cbor: string } | undefined;
                if (outputScript) {
                    try {
                        script = {
                            type: outputScript.language.replace(':', '_'),
                            cbor: outputScript.cbor ?? ''
                        };
                    } catch (error) {
                        Logger.log({
                            message: `Error error getting script for ${txId}`,
                            category: LogCategory.ERROR,
                            event: 'processBlock.decodingScript'
                        });
                    }
                }

                const input: ProcessAssetTokenInput = {
                    assetName,
                    address: o.address,
                    slotNumber: currentSlot,
                    utxo: `${txId}#${i}`,
                    lovelace: parseInt(o.value['ada'].lovelace.toString()),
                    datum: datumString,
                    script,
                    handleMetadata,
                    isMintTx
                };

                // if (assetName.includes('0000000076324073685f73657474696e67735f303131')) {
                //     console.log('IM_GOING_TO_PROCESS_ASSET_TOKEN', input);
                // }

                // console.log('IM_GOING_TO_PROCESS_ASSET_TOKEN', input);
                // Logger.log({ message: `Process ${stringifyBlock(input)} | ASSET_NAME_LABEL ${Object.values(AssetNameLabel).some((v) => assetName.startsWith(`${policyId}.${v}`))} | ASSET_NAME_LABELS ${Object.values(AssetNameLabel).join(',')} | AssetNameLabel.LBL_001 ${AssetNameLabel.LBL_001}`, category: LogCategory.INFO, event: 'processAssetToken.input' });

                if (Object.values(AssetNameLabel).some((v) => assetName.startsWith(v))) {
                    await processAssetClassToken(input);
                } else {
                    await processAssetToken(input);
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
