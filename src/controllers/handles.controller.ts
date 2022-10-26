import { NextFunction, Request, Response } from 'express';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { IGetAllQueryParams, IGetHandleRequest } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import { HandleSearchModel } from '../models/HandleSearch.model';
import IHandlesRepository from '../repositories/handles.repository';

class HandlesController {
    public getAll = async (
        req: Request<RequestWithRegistry, {}, {}, IGetAllQueryParams>,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();

            if (req.headers?.accept === 'text/plain') {
                const handles = await handleRepo.getAllHandleNames();
                res.set('Content-Type', 'text/plain');
                res.send(handles.join('\n'));
                return;
            }

            const { limit = '100', sort = 'desc', cursor, characters, length, rarity, numeric_modifiers } = req.query;
            const pagination = new HandlePaginationModel(limit, sort, cursor);
            const search = new HandleSearchModel({ characters, length, rarity, numeric_modifiers });
            const handleData = await handleRepo.getAll({ pagination, search });
            res.status(200).json(handleData);
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

            res.status(200).json(handleData);
        } catch (error) {
            next(error);
        }
    };
}

export default HandlesController;
