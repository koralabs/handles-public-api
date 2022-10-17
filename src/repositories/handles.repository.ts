import { IGetAllHandlesResults, IHandle, IHandleStats } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';

interface IHandlesRepository {
    getAll: (pagination: HandlePaginationModel) => Promise<IGetAllHandlesResults>;
    getAllHandleNames(): Promise<string[]>;
    getHandleByName: (handleName: string) => Promise<IHandle>;
    getHandleStats: () => IHandleStats;
}

export default IHandlesRepository;
