import { IHandle, IPersonalization, IPersonalizedHandle, Rarity } from '@koralabs/handles-public-api-interfaces';
import { HttpException } from '../../exceptions/HttpException';

export class PersonalizedHandleViewModel {
    personalization?: IPersonalization;

    constructor(handle: IPersonalizedHandle) {
        if (!handle.utxo) {
            throw new HttpException(404, 'Handle not found');
        }

        this.personalization = handle.personalization;
    }
}
