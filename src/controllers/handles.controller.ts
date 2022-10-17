import { NextFunction, Request, Response } from 'express';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { IGetHandleRequest } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import IHandlesRepository from '../repositories/handles.repository';

class HandlesController {
    public getAll = async (
        req: Request<RequestWithRegistry, {}, {}, { limit?: string; cursor?: string; sort?: 'asc' | 'desc' }>,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { limit = '100', cursor, sort = 'desc' } = req.query;
            const pagination = new HandlePaginationModel(limit, sort, cursor);
            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();

            if (req.headers?.['content-type'] === 'text/plain') {
                const handles = await handleRepo.getAllHandleNames();
                res.set('Content-Type', 'text/plain');
                res.send(handles.join('\n'));
                return;
            }

            const handleData = await handleRepo.getAll(pagination);
            res.status(200).json({ data: handleData });
        } catch (error) {
            next(error);
        }
    };

    public getHandle = async (
        req: Request<IGetHandleRequest, {}, {}>,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const handleName = req.params.handle;
            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            const handleData = await handleRepo.getHandleByName(handleName);

            res.status(200).json({ data: handleData });
        } catch (error) {
            next(error);
        }
    };
}

export default HandlesController;
