import { AssetNameLabel, checkNameLabel, LogCategory, Logger } from '@koralabs/kora-labs-common';
import fetch from 'cross-fetch';
import v8 from 'v8';
import { NODE_ENV, OGMIOS_HOST } from '../../../config';
import { HealthResponseBody } from '../../../interfaces/ogmios.interfaces';

const parseCborObject = (value: any) => {
    const lastKey = Object.keys(value).pop();
    let objString = '';
    if (typeof value === 'object') {
        // We add the first curly brace
        objString += '{';
        for (const key in value) {
            if (key === 'map') {
                for (let i = 0; i < value[key].length; i++) {
                    const { k, v } = value[key][i];

                    if (v.map) {
                        objString += `"${k.string}":${parseCborObject(v)}`;
                    } else {
                        objString += `"${k.string}":${parseCborObject(v.string ?? v.int ?? v.list ?? '')}`;
                    }

                    // We add the comma
                    if (value[key].length !== i + 1) {
                        objString += ',';
                    }
                }
            } else {
                objString += `"${key}":${parseCborObject(value[key])}`;
            }

            // We add the comma
            if (key !== lastKey) {
                objString += ',';
            }
        }
        // We add the last curly brace
        objString += '}';
    } else if (typeof value === 'string') {
        objString += `"${value}"`;
    } else if (typeof value === 'number') {
        objString += `${value}`;
    } else if (typeof value === 'bigint') {
        objString += `${Number(value)}`;
    }
    return objString;
};

/**
 *
 * expecting cbor metadata after 721 or some other label
 *
 * @param metadata
 * @returns parsed metadata
 */
export const buildOnChainObject = <T>(cborData: any): T | null => {
    try {
        const stringifiedMetadata = parseCborObject(cborData);
        return JSON.parse(stringifiedMetadata) as T;
    } catch (error: any) {
        Logger.log(`Error building metadata: ${error.message}`);
        return null;
    }
};

export const getHandleNameFromAssetName = (asset: string): { name: string; hex: string, isCip67: boolean, assetLabel: AssetNameLabel, assetName: string } => {
    let hex = `${asset}`;
    
    // check if asset name has a period. If so, it includes the policyId
    if (hex.includes('.')) {
        hex = hex.split('.')[1];
    }
    const {isCip67, name, assetLabel} = checkNameLabel(hex)
    if (isCip67) {
        hex = `${assetLabel == AssetNameLabel.LBL_000 ? assetLabel : AssetNameLabel.LBL_222}${hex.replace(assetLabel ?? '', '')}`
    }

    return {
        name,
        hex,
        isCip67,
        assetLabel,
        assetName: asset
    };
};

export const fetchHealth = async (): Promise<HealthResponseBody | null> => {
    let ogmiosResults = null;
    try {
        const ogmiosResponse = await fetch(`${OGMIOS_HOST}/health`);
        ogmiosResults = await ogmiosResponse.json();
    } catch (error: any) {
        Logger.log({ message: error.message, category: LogCategory.ERROR, event: 'fetchOgmiosHealth.error' });
    }
    return ogmiosResults;
};

const canExitProcess = () => {
    return NODE_ENV !== 'test';
};

/**
 * Used to monitor memory usage and kill the process when it gets above 90%.
 */
export const memoryWatcher = () => {
    const heap = v8.getHeapStatistics();
    const usage = (heap.used_heap_size / heap.heap_size_limit) * 100;
    if (usage > 80 && usage < 90) {
        Logger.log({
            message: `Memory usage close to the limit (${usage.toFixed()}%)`,
            event: 'memoryWatcher.limit.close',
            category: LogCategory.INFO
        });
    } else if (usage > 90) {
        Logger.log({
            message: `Memory usage has reached the limit (${usage.toFixed()}%)`,
            event: 'memoryWatcher.limit.reached',
            category: LogCategory.NOTIFY
        });

        if (canExitProcess()) process.exit(1);
    }
};
