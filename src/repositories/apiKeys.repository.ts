import IApiKey from '../interfaces/apiKey.interface';

interface IApiKeysRepository {
    get: (key: string) => Promise<IApiKey>;
}

export default IApiKeysRepository;
