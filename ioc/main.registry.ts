import { IRegistry } from '../interfaces/registry.interface';
import { MemoryHandlesRepository } from '../repositories/memory';
import MemoryApiKeysRepository from '../repositories/memory/apiKeys.repository';

const registry: IRegistry = {
    ['handlesRepo']: MemoryHandlesRepository,
    ['apiKeysRepo']: MemoryApiKeysRepository
};

export default registry as IRegistry