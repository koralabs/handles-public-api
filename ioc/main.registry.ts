import { IRegistry } from '../interfaces/registry.interface';
import { MemoryHandlesProvider } from '../repositories/memory';
import MemoryApiKeysRepository from '../repositories/memory/apiKeys.repository';

const registry: IRegistry = {
    ['handlesProvider']: MemoryHandlesProvider,
    ['apiKeysRepo']: MemoryApiKeysRepository
};

export default registry as IRegistry