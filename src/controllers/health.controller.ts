import { NextFunction, Request, Response } from 'express';
import IHandlesRepository from '../repositories/handles.repository';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { fetchHealth } from '../services/ogmios/utils';

enum HealthStatus {
    CURRENT = 'current',
    OGMIOS_BEHIND = 'ogmios_behind',
    STORAGE_BEHIND = 'storage_behind'
}

class HealthController {
    public index = async (req: Request<RequestWithRegistry>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const ogmiosResults = await fetchHealth();

            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            const stats = handleRepo.getHandleStats();

            if (!ogmiosResults) {
                res.status(202).json({
                    ogmios: null,
                    stats
                });
                return;
            }

            // check if ogmios is still trying to catch up.
            const { lastTipUpdate } = ogmiosResults;

            const date = new Date(lastTipUpdate).getTime();
            const now = new Date().getTime();

            if (date < now - 60000) {
                res.status(202).json({
                    status: HealthStatus.OGMIOS_BEHIND,
                    ogmios: ogmiosResults,
                    stats
                });
                return;
            }

            // check if storage is still trying to catch up.
            if (stats.percentageComplete !== '100.00') {
                res.status(202).json({
                    status: HealthStatus.STORAGE_BEHIND,
                    ogmios: ogmiosResults,
                    stats
                });
                return;
            }

            res.status(200).json({
                status: HealthStatus.CURRENT,
                ogmios: ogmiosResults,
                stats
            });
        } catch (error) {
            next(error);
        }
    };
}

export default HealthController;
