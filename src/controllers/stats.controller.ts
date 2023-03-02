import { NextFunction, Request, Response } from 'express';
import IHandlesRepository from '../repositories/handles.repository';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { HandleStore } from '../repositories/memory/HandleStore';

class StatsController {
    public index = async (req: Request<RequestWithRegistry>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            res.status(handleRepo.getIsCaughtUp() ? 200 : 202).json(handleRepo.getTotalHandlesStats());
        } catch (error) {
            next(error);
        }
    };
}

export default StatsController;
