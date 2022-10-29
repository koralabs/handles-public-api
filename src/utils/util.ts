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

export const writeConsoleLine = (startTime: number, msg = ''): void => {
    const elapsed = getElapsedTime(Date.now() - startTime);
    const message = `${elapsed} elapsed. ${msg}`;
    if (process.stdout?.clearLine && process.stdout?.cursorTo) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(message);
    } else {
        Logger.log(message);
    }
};
