import fetch from 'cross-fetch';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import { decodeCborToJson } from '../cbor';

export const decodeCborFromIPFSFile = async (url: string, schema?: any): Promise<any> => {
    try {
        const result = await fetch(url);
        const buff = await result.arrayBuffer();
        if (buff) {
            try {
                const cbor = Buffer.from(buff).toString('hex');
                const json = await decodeCborToJson(cbor, schema);
                const [data] = json.constructor_0;
                return data;
            } catch (error: any) {
                Logger.log({
                    message: `Error parsing json from ${url} with error ${error.message}`,
                    category: LogCategory.ERROR,
                    event: 'decodeCborFromIPFSFile.parseJSON.error'
                });
            }
        }
    } catch (error: any) {
        console.log('ERROR', error);
        Logger.log({
            message: `Error getting data from ${url} data with error ${error.message}`,
            category: LogCategory.ERROR,
            event: 'decodeCborFromIPFSFile.error'
        });
    }
};
