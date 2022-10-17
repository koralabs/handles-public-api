import { NextFunction, Request, Response } from 'express';
import fetch from 'cross-fetch';
import { OGMIOS_ENDPOINT } from '../config';
import IHandlesRepository from '../repositories/handles.repository';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { LogCategory, Logger } from '../utils/logger';


class HealthController {
    public index = async (req: Request<RequestWithRegistry>, res: Response, next: NextFunction): Promise<void> => {
        try {
            let ogmiosResults = null;
            try {
                const ogmiosResponse = await fetch(`${OGMIOS_ENDPOINT}/health`);
                ogmiosResults = await ogmiosResponse.json();
            } catch (error: any) {
                Logger.log(error.message, LogCategory.ERROR);
            }

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
