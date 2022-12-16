import { NextFunction, Request, Response } from 'express';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { IGetAllQueryParams, IGetHandleRequest } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import { HandleSearchModel } from '../models/HandleSearch.model';
import IHandlesRepository from '../repositories/handles.repository';
import ProtectedWords from '@koralabs/protected-words';
import { AvailabilityResponseCode } from '@koralabs/protected-words/lib/interfaces';

class HandlesController {
    public getAll = async (
        req: Request<RequestWithRegistry, {}, {}, IGetAllQueryParams>,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { handles_per_page, sort = 'desc', page, characters, length, rarity, numeric_modifiers } = req.query;
            const search = new HandleSearchModel({ characters, length, rarity, numeric_modifiers });

            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();

            if (req.headers?.accept?.startsWith('text/plain')) {
                const handles = await handleRepo.getAllHandleNames(search, sort);
                res.set('Content-Type', 'text/plain; charset=utf-8');
                res.send(handles.join('\n'));
                return;
            }

            const pagination = new HandlePaginationModel(handles_per_page, sort, page);
            const handleData = await handleRepo.getAll({ pagination, search });
            res.status(200).json(handleData.handles);
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

            const result = await ProtectedWords.checkAvailability(handleName);
            if (!result.available) {
                res.status(result.code).send({
                    message:
                        result.code === AvailabilityResponseCode.NOT_AVAILABLE_FOR_LEGAL_REASONS
                            ? result.reason
                            : result.message
                });
                return;
            }

            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            const handleData = await handleRepo.getHandleByName(handleName);

            res.status(200).json(handleData);
        } catch (error) {
            next(error);
        }
    };

    public async getPersonalizedHandle(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const handleName = req.params.handle;

            const result = await ProtectedWords.checkAvailability(handleName);
            if (!result.available) {
                res.status(result.code).send({
                    message:
                        result.code === AvailabilityResponseCode.NOT_AVAILABLE_FOR_LEGAL_REASONS
                            ? result.reason
                            : result.message
                });
                return;
            }

            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            const handleData = await handleRepo.getPersonalizedHandleByName(handleName);

            res.status(200).json(handleData);
        } catch (error) {
            next(error);
        }
    }
}

export default HandlesController;
