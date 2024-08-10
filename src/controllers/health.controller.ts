import { NextFunction, Request, Response } from 'express';
import IHandlesRepository from '../repositories/handles.repository';
import { fetchHealth } from '../services/ogmios/utils';
import { IRegistry } from '../ioc';

enum HealthStatus {
    CURRENT = 'current',
    OGMIOS_BEHIND = 'ogmios_behind',
    STORAGE_BEHIND = 'storage_behind',
    WAITING_ON_CARDANO_NODE = 'waiting_on_cardano_node'
}

class HealthController {
    public index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const ogmiosResults = await fetchHealth();
            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();
            console.log(handleRepo);
            console.log(JSON.stringify(handleRepo));
            const stats = handleRepo.getHandleStats();

            if (!ogmiosResults) {
                res.status(202).json({
                    ogmios: null,
                    stats
                });
                return;
            }

            let status = HealthStatus.CURRENT;
            if (!handleRepo.isCaughtUp()) {
                status = HealthStatus.STORAGE_BEHIND;
            }
            if (ogmiosResults.networkSynchronization < 1) {
                status = HealthStatus.OGMIOS_BEHIND;
            }
            if (ogmiosResults.connectionStatus !== 'connected') {
                status = HealthStatus.WAITING_ON_CARDANO_NODE;
            }

            let statusCode = 200;
            if (status == HealthStatus.WAITING_ON_CARDANO_NODE)
                statusCode = 503;
            else if (status != HealthStatus.CURRENT)
                statusCode = 202;

            res.status(statusCode).json({
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
