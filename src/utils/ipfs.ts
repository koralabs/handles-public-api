import fetch from 'cross-fetch';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';

export const decodeCborFromIPFSFile = async (url: string): Promise<unknown> => {
    try {
        const result = await fetch(url);
        const str = await result.body?.getReader().read();
        if (str?.value) {
            try {
                const jsonString = Buffer.from(str?.value).toString();
                return JSON.parse(jsonString);
            } catch (error: any) {
                Logger.log({
                    message: `Error parsing json from ${url} with error ${error.message}`,
                    category: LogCategory.ERROR,
                    event: 'decodeCborFromIPFSFile.parseJSON.error'
                });
            }
        }
    } catch (error: any) {
        Logger.log({
            message: `Error getting data from ${url} data with error ${error.message}`,
            category: LogCategory.ERROR,
            event: 'decodeCborFromIPFSFile.error'
        });
    }
};
