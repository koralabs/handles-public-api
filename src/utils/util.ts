import { Logger } from '@koralabs/kora-labs-common';
import fs from 'fs';
import { DynamicLoadType } from '../interfaces/util.interface';
import { NETWORK } from '../config';
import { IPersonalizedHandle, ScriptDetails } from '@koralabs/handles-public-api-interfaces';

export const isNumeric = (n: string) => {
    return !isNaN(parseFloat(n)) && isFinite(parseFloat(n));
};

export const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

export const awaitForEach = async <T>(array: T[], callback: (item: T, index: number, array: T[]) => Promise<void>) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
};

export const getElapsedTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    return `${mins}:${(seconds - mins * 60).toString().padStart(2, '0')}`;
};

export const writeConsoleLine = (startTime: number, msg = ''): string => {
    const elapsed = getElapsedTime(Date.now() - startTime);
    const message = `${elapsed} elapsed. ${msg}`;
    if (process.stdout?.clearLine && process.stdout?.cursorTo) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(message);
    } else {
        Logger.log(message);
    }

    return message;
};

export const dynamicallyLoad = async (folderPath: string, type: DynamicLoadType) => {
    const files = fs.readdirSync(folderPath);
    const filteredFiles = files.filter((f) => new RegExp(`[\\w]+\\.${type}\\.(ts|js)$`, 'gi').test(f));

    return Promise.all(
        filteredFiles.map(async (f) => {
            //Logger.log(`Dynamically loading: ${f}`);
            const imported = await import(`${folderPath}/${f}`);
            try {
                return new imported.default();
            } catch (error) {
                return imported.default;
            }
        })
    );
};

export const getDateStringFromSlot = (currentSlot: number): Date => {
    // TODO: Make this work for all networks
    //console.log(`preview slot date = ${new Date(currentSlot * 1000)}`)
    if (NETWORK == 'preview') {
        return new Date((1666656000 + currentSlot) * 1000);
    }
    if (NETWORK == 'preprod') {
        return new Date((1654041600 + currentSlot) * 1000);
    }
    return new Date((1596491091 + (currentSlot - 4924800)) * 1000);
};

export const getSlotNumberFromDate = (date: Date): number => {
    if (NETWORK == 'preview') {
        return Math.floor(date.getTime() / 1000) - 1666656000;
    }
    if (NETWORK == 'preprod') {
        return Math.floor(date.getTime() / 1000) - 1654041600;
    }
    // Ignore parens to show intent
    // prettier-ignore
    return (Math.floor(date.getTime() / 1000) - 1596491091) + 4924800;
};
