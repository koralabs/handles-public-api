import { IRegistry } from '../interfaces/registry.interface';
import { MemoryApiKeysRepository } from '../repositories/apiKeys.repository';
import { HandlesMemoryStore } from '../stores/memory';

const registry: IRegistry = {
    ['handlesRepo']: HandlesMemoryStore,
    ['apiKeysRepo']: MemoryApiKeysRepository
};

export default registry as IRegistry