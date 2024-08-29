import { IRegistry } from '../interfaces/registry.interface';
import MemoryApiKeysRepository from '../repositories/memory/apiKeys.repository';
import MemoryHandlesRepository from '../repositories/memory/handles.repository';

const registry: IRegistry = {
    ['handlesRepo']: MemoryHandlesRepository,
    ['apiKeysRepo']: MemoryApiKeysRepository
};

export default registry as IRegistry