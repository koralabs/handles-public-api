import { IReferenceToken, ICip68Handle, HttpException } from '@koralabs/kora-labs-common';

export class HandleReferenceTokenViewModel {
    reference_token?: IReferenceToken;

    constructor(handle: ICip68Handle | null) {
        if (!handle?.utxo) {
            throw new HttpException(404, 'Handle not found');
        }

        this.reference_token = handle.reference_token;
    }
}
