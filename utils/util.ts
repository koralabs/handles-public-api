import { getElapsedTime, Logger, StoredHandle } from '@koralabs/kora-labs-common';
import fs from 'fs';
import { DynamicLoadType } from '../interfaces/util.interface';

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
            } catch {
                return imported.default;
            }
        })
    );
};

export const debugLog = (msg: string, blockSlot: number, handle?: StoredHandle | null) => {
    console.log('**************************************************************');
    console.log(msg);
    console.log({
        blockSlot, 
        hex: handle?.hex,
        amount: handle?.amount,
        handleSlot: handle?.updated_slot_number, 
        address: handle?.resolved_addresses?.ada,
        utxo: handle?.utxo
    });
    console.log('______________________________________________________________');
}