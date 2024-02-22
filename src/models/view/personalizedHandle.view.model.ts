import { ApiHandle, IPersonalization } from '@koralabs/kora-labs-common';
import { HttpException } from '../../exceptions/HttpException';

export class PersonalizedHandleViewModel {
    personalization?: IPersonalization;

    constructor(handle: ApiHandle | null) {
        if (!handle?.utxo) {
            throw new HttpException(404, 'Handle not found');
        }

        this.personalization = handle.personalization;
    }
}
