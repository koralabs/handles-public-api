import * as cbor from '@koralabs/kora-labs-common/utils/cbor';
import * as config from '../../config';
import { decodeCborFromIPFSFile } from './index';
import * as ipfs from './requestIpfs';

jest.mock('../../config');
jest.mock('./requestIpfs');

describe('decodeCborFromIPFSFile tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return ipfs json', async () => {
        jest.spyOn(config, 'getIpfsGateway').mockReturnValue('https://ipfs.io/ipfs/');
        jest.spyOn(ipfs, 'requestIpfs').mockResolvedValue({
            statusCode: 200,
            cbor: 'd879'
        });
        jest.spyOn(cbor, 'decodeCborToJson').mockResolvedValue({ test: 'test' });

        const result = await decodeCborFromIPFSFile('zb2rhYHWj4Ls35aM5V1odX38rSJJSFyvq3x4dyfbFPwCBRBTA');
        expect(result).toEqual({ test: 'test' });
    });

    it('should return hit the backup if first ipfs link was unsuccessful', async () => {
        jest.spyOn(config, 'getIpfsGateway').mockReturnValue('https://ipfs.io/ipfs/');
        const requestIpfsSpy = jest
            .spyOn(ipfs, 'requestIpfs')
            .mockResolvedValueOnce({
                statusCode: 400,
                cbor: ''
            })
            .mockResolvedValueOnce({
                statusCode: 200,
                cbor: 'd879'
            });
        jest.spyOn(cbor, 'decodeCborToJson').mockResolvedValue({ test: 'test' });

        const cid = 'zb2rhYHWj4Ls35aM5V1odX38rSJJSFyvq3x4dyfbFPwCBRBTA';
        const result = await decodeCborFromIPFSFile(cid);
        expect(result).toEqual({ test: 'test' });
        expect(requestIpfsSpy).toBeCalledTimes(2);
        expect(requestIpfsSpy).nthCalledWith(2, `https://ipfs.io/ipfs/${cid}?pinataGatewayToken=undefined`);
    });
});
