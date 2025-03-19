import { getDateStringFromSlot, getElapsedTime, LogCategory, Logger } from '@koralabs/kora-labs-common';
import { NextFunction, Request, Response } from 'express';
import { IRegistry } from '../interfaces/registry.interface';
import { HandlesRepository } from '../repositories/handlesRepository';
import { fetchHealth } from '../services/ogmios/utils';

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
            const handleRepo: HandlesRepository = new HandlesRepository(new (req.app.get('registry') as IRegistry).handlesRepo());
            const { firstSlot = 0, lastSlot = 0, currentSlot = 0, firstMemoryUsage = 0, elapsedOgmiosExec = 0, elapsedBuildingExec = 0, currentBlockHash = '', memorySize = 0, schemaVersion = 0, count = 0 } = handleRepo.getMetrics();
            const handleSlotRange = lastSlot - firstSlot;
            const currentSlotInRange = currentSlot - firstSlot;
            const percentageComplete = currentSlot === 0 ? '0.00' : ((currentSlotInRange / handleSlotRange) * 100).toFixed(2);
            const currentMemoryUsage = process.memoryUsage().rss;
            const currentMemoryUsed = Math.round(((currentMemoryUsage - firstMemoryUsage) / 1024 / 1024) * 100) / 100;
            const ogmiosElapsed = getElapsedTime(elapsedOgmiosExec);
            const buildingElapsed = getElapsedTime(elapsedBuildingExec);
            const slotDate = getDateStringFromSlot(currentSlot);
    
            const stats = {
                percentage_complete: percentageComplete,
                current_memory_used: currentMemoryUsed,
                ogmios_elapsed: ogmiosElapsed,
                building_elapsed: buildingElapsed,
                slot_date: slotDate,
                handle_count: count,
                memory_size: memorySize,
                current_slot: currentSlot,
                current_block_hash: currentBlockHash,
                schema_version: schemaVersion
            };

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
            
            res.status(statusCode).json({
                status,
                ogmios: ogmiosResults,
                stats
            });
        } catch (error: any) {
            next(error);
        }
    };
}

export default HealthController;
