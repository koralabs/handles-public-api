import MemoryHandlesRepository from '../repositories/memory/handles.repository';

export enum RepoName {
    handlesRepo = 'handlesRepo',
    apiKeysRepo = 'apiKeysRepo'
}

export interface IRegistry extends Record<keyof typeof RepoName, any> {}

export const registry: IRegistry = {
    [RepoName.handlesRepo]: MemoryHandlesRepository,
    [RepoName.apiKeysRepo]: {}
};
