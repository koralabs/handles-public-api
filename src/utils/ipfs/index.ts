import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import { decodeCborToJson } from '../cbor';
import { requestIpfs } from './requestIpfs';
import { getIpfsGateway } from '../../config';

export const decodeCborFromIPFSFile = async (cid: string, schema?: any): Promise<any> => {
    let ipfsGateway = getIpfsGateway();

    try {
        let result = await requestIpfs(`${ipfsGateway}${cid}`);

        if (result.statusCode !== 200) {
            ipfsGateway = getIpfsGateway(true);
            if (ipfsGateway.length > 12) {
                // at least 13 characters in a an HTTPS URL
                const { CID } = await import('multiformats/cid');
                const { base32 } = await import('multiformats/bases/base32');
                const base32Cid = CID.parse(cid).toString(base32.encoder);
                result = await requestIpfs(`${ipfsGateway}${base32Cid}`);
            } else {
                throw new Error(
                    `Status from primary gateway resulted in status ${result.statusCode}. Backup gateway "${ipfsGateway}" is invalid`
                );
            }
        }

        const { cbor } = result;

        if (cbor) {
            try {
                const json = await decodeCborToJson(cbor, schema);
                if (json.hasOwnProperty('constructor_0')) {
                    const [data] = json.constructor_0;
                    return data;
                }

                return json;
            } catch (error: any) {
                Logger.log({
                    message: `Error parsing json from ${ipfsGateway}${cid} with error ${error.message}`,
                    category: LogCategory.ERROR,
                    event: 'decodeCborFromIPFSFile.parseJSON.error'
                });
            }
        }
    } catch (error: any) {
        console.log('ERROR', error);
        Logger.log({
            message: `Error getting data from ${ipfsGateway}${cid} data with error ${error.message}`,
            category: LogCategory.ERROR,
            event: 'decodeCborFromIPFSFile.error'
        });
    }
};
