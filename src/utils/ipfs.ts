import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import { decodeDatum } from './serialization';

export const decodeCborFromIPFSFile = async (url: string): Promise<unknown> => {
    try {
        const result = await fetch(url);
        const str = await result.body?.getReader().read();
        if (str?.value) {
            const cborHex = Buffer.from(str?.value).toString('hex');
            return decodeDatum(cborHex);
        }
    } catch (error: any) {
        Logger.log({
            message: `Error getting data from ${url} data with error ${error.message}`,
            category: LogCategory.ERROR,
            event: 'decodeCborFromIPFSFile.error'
        });
    }
};
