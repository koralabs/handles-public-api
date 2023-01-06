import { Logger } from '@koralabs/kora-labs-common';

export const manualRollback = async (
    processMessage: Function,
    timeout = 35000,
    slot = 13631415,
    hash = 'a0177bc9ad5cc0a04ea5ccd3b5e3817ef33d885156434e4f0de34847dcfc114a'
) => {
    setTimeout(async () => {
        Logger.log('PERFORMING ROLLBACK!!!');
        await processMessage(
            JSON.stringify({
                type: 'jsonwsp/response',
                version: '1.0',
                servicename: 'ogmios',
                methodname: 'RequestNext',
                result: {
                    RollBackward: {
                        point: {
                            slot,
                            hash
                        },
                        tip: {
                            slot: 17288960,
                            hash: 'f69cbe83f0129c7691b61e96ddb16805751f54aa3e2ea7e1e17cb2fb837e4d81',
                            blockNo: 487552
                        }
                    }
                },
                reflection: null
            })
        );
    }, timeout);
};
