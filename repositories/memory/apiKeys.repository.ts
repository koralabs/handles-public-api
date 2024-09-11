import { HttpException } from '@koralabs/kora-labs-common';

import IApiKey from '../../interfaces/apiKey.interface';
import IApiKeysRepository from '../apiKeys.repository';

class MemoryApiKeysRepository implements IApiKeysRepository {
    public async get(key?: string): Promise<IApiKey> {
        if (!key) {
            throw new HttpException(404, 'Not found');
        }

        const data: IApiKey = {
            id: `key_${key}`
        };

        return data;
    }
}

export default MemoryApiKeysRepository;
