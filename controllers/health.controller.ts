import { IHandlesRepository, LogCategory, Logger } from '@koralabs/kora-labs-common';
import { NextFunction, Request, Response } from 'express';
import { IRegistry } from '../interfaces/registry.interface';
import { fetchHealth } from '../services/ogmios/utils';

enum HealthStatus {
    CURRENT = 'current',
    OGMIOS_BEHIND = 'ogmios_behind',
    STORAGE_BEHIND = 'storage_behind',
    WAITING_ON_CARDANO_NODE = 'waiting_on_cardano_node'
}

class HealthController {
    public index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        Logger.log(`HEALTH CHECK: HEADERS - ${JSON.stringify(req.headers)}`);
        try {
            const ogmiosResults = await fetchHealth();
            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();
            const stats = handleRepo.getHandleStats();
            Logger.log(`HEALTH CHECK: OGMIOS RESULTS - ${ogmiosResults?.connectionStatus}`);

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
                Logger.log({category:LogCategory.WARN, message: 'Ogmios can\'t connect to the node socket', event: 'healthcheck.failure'});
                status = HealthStatus.WAITING_ON_CARDANO_NODE;
            }

            let statusCode = 200;
            if (status == HealthStatus.WAITING_ON_CARDANO_NODE)
                statusCode = 503;
            else if (status != HealthStatus.CURRENT)
                statusCode = 202;
            
            Logger.log(`HEALTH CHECK: STATUS - ${statusCode}: ${status}`);
            res.status(statusCode).json({
                status,
                ogmios: ogmiosResults,
                stats
            });
        } catch (error: any) {
            Logger.log(`HEALTH CHECK: ERROR - ${error.message}`);
            next(error);
        }
    };
}

export default HealthController;
