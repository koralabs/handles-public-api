import { IReferenceToken, ICip68Handle } from '@koralabs/kora-labs-common';
import { HttpException } from '../../exceptions/HttpException';

export class HandleReferenceTokenViewModel {
    reference_token?: IReferenceToken;

    constructor(handle: ICip68Handle | null) {
        if (!handle?.utxo) {
            throw new HttpException(404, 'Handle not found');
        }

        this.reference_token = handle.reference_token;
    }
}
