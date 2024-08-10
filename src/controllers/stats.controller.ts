import { NextFunction, Request, Response } from 'express';
import IHandlesRepository from '../repositories/handles.repository';
import { IRegistry } from '../ioc';

class StatsController {
    public index = async (req: Request<Request>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();
            res.status(handleRepo.currentHttpStatus()).json(handleRepo.getTotalHandlesStats());
        } catch (error) {
            next(error);
        }
    };
}

export default StatsController;
