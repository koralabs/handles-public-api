import { NextFunction, Request, Response } from 'express';
import IHandlesRepository from '../repositories/handles.repository';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { fetchHealth } from '../services/ogmios/utils';

enum HealthStatus {
    CURRENT = 'current',
    OGMIOS_BEHIND = 'ogmios_behind',
    STORAGE_BEHIND = 'storage_behind',
    WAITING_ON_CARDANO_NODE = 'waiting_on_cardano_node'
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

            let status = HealthStatus.CURRENT;
            if (stats.percentageComplete !== '100.00') {
                status = HealthStatus.STORAGE_BEHIND;
            }
            if (date < now - 60000) {
                status = HealthStatus.OGMIOS_BEHIND;
            }
            if (ogmiosResults.connectionStatus !== 'connected') {
                status = HealthStatus.WAITING_ON_CARDANO_NODE;
            }

            res.status(status === HealthStatus.CURRENT ? 200 : 202).json({
                status,
                ogmios: ogmiosResults,
                stats
            });
        } catch (error) {
            next(error);
        }
    };
}

export default HealthController;
