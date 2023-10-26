import { IPersonalization, IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';
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
