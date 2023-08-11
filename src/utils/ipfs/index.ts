import fetch from 'cross-fetch';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import { decodeCborToJson } from '../cbor';
import { IPFS_GATEWAY, IPFS_GATEWAY_BACKUP } from '../../config';

export const decodeCborFromIPFSFile = async (cid: string, schema?: any): Promise<any> => {
    try {
        let result = await fetch(`${IPFS_GATEWAY}${cid}`);
        if (!result.ok && IPFS_GATEWAY_BACKUP.length > 12) { // at least 13 characters in a an HTTPS URL
            const { CID } = await import('multiformats/cid');
            const { base32 } = await import('multiformats/bases/base32');
            result = await fetch(`${IPFS_GATEWAY_BACKUP}${CID.parse(cid).toString(base32.encoder)}`);
        }
        const buff = await result.arrayBuffer();
        if (buff) {
            try {
                const cbor = Buffer.from(buff).toString('hex');
                const json = await decodeCborToJson(cbor, schema);
                if (json.hasOwnProperty('constructor_0')) {
                    const [data] = json.constructor_0;
                    return data;
                }
                
                return json;
            } catch (error: any) {
                Logger.log({
                    message: `Error parsing json from ${IPFS_GATEWAY}${cid} with error ${error.message}`,
                    category: LogCategory.ERROR,
                    event: 'decodeCborFromIPFSFile.parseJSON.error'
                });
            }
        }
    } catch (error: any) {

        console.log('ERROR', error);
        Logger.log({
            message: `Error getting data from ${IPFS_GATEWAY}${cid} data with error ${error.message}`,
            category: LogCategory.ERROR,
            event: 'decodeCborFromIPFSFile.error'
        });
    }
};
