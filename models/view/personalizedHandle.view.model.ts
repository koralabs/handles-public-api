import { IPersonalization } from '@koralabs/kora-labs-common';
import { HttpException } from '../../exceptions/HttpException';
import { StoredHandle } from '../../interfaces/handleStore.interfaces';

export class PersonalizedHandleViewModel {
    personalization?: IPersonalization;

    constructor(handle: StoredHandle | null) {
        if (!handle?.utxo) {
            throw new HttpException(404, 'Handle not found');
        }

        this.personalization = handle.personalization;
    }
}
