import { IPersonalization, HttpException, StoredHandle } from '@koralabs/kora-labs-common';

export class PersonalizedHandleViewModel {
    personalization?: IPersonalization;

    constructor(handle: StoredHandle | null) {
        if (!handle?.utxo) {
            throw new HttpException(404, 'Handle not found');
        }

        this.personalization = handle.personalization;
    }
}
