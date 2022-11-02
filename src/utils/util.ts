import fs from 'fs';
import { DynamicLoadType } from '../interfaces/util.interface';
import BaseRoute from '../routes/base';
import { Logger } from './logger';

export const isNumeric = (n: string) => {
    return !isNaN(parseFloat(n)) && isFinite(parseFloat(n));
};

export const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    const filteredFiles = files.filter((f) => new RegExp(`[\\w]+\\.${type}\\.(ts|js)`, 'gi').test(f));

    return Promise.all(
        filteredFiles.map(async (f) => {
            Logger.log(`Dynamically loading: ${f}`);
            const imported = await import(`${folderPath}/${f}`);
            try {
                return new imported.default();
            } catch (error) {
                return imported.default;
            }
        })
    );
};
