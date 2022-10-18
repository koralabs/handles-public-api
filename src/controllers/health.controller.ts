import { NextFunction, Request, Response } from 'express';
import IHandlesRepository from '../repositories/handles.repository';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { fetchHealth } from '../services/ogmios/utils';


class HealthController {
    public index = async (req: Request<RequestWithRegistry>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const ogmiosResults = await fetchHealth();

            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            const stats = handleRepo.getHandleStats();

            res.status(200).json({
                ogmios: ogmiosResults,
                stats
            });
        } catch (error) {
            next(error);
        }
    };
}

export default HealthController;
