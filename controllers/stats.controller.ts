import { NextFunction, Request, Response } from 'express';
import { IHandlesRepository } from '@koralabs/kora-labs-common';
import { IRegistry } from '../interfaces/registry.interface';;

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
