import { IPersonalization, IPersonalizedHandle } from '@koralabs/kora-labs-common';
import { HttpException } from '../../exceptions/HttpException';

export class PersonalizedHandleViewModel {
    personalization?: IPersonalization;

    constructor(handle: IPersonalizedHandle | null) {
        if (!handle?.utxo) {
            throw new HttpException(404, 'Handle not found');
        }

        this.personalization = handle.personalization;
    }
}
