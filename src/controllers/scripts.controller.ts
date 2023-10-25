import { NextFunction, Request, Response } from 'express';
import IHandlesRepository from '../repositories/handles.repository';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { scripts } from '../config/scripts';
import { LatestScriptResult } from '../interfaces/scripts.interface';
import { validateScriptDetails } from '../utils/util';
import { IPersonalizedHandle } from '@koralabs/handles-public-api-interfaces';

class StatsController {
    public index = async (req: Request<RequestWithRegistry>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { latest = false } = req.query;

            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();

            const network = process.env.NETWORK ?? 'preview';
            const allScripts = scripts[network];

            if (latest) {
                const latestScript = Object.entries(scripts[network]).find(([_, value]) => value.latest);

                if (!latestScript) {
                    // send a 404 if no latest script is found
                    res.status(404).send({ message: 'Latest script not found' });
                    return;
                }

                const [scriptAddress, scriptData] = latestScript;
                
                let handleData: IPersonalizedHandle | null = null;
                if (req.query.hex == 'true') {
                    handleData = await handleRepo.getHandleByHex(scriptData.handle);
                }
                else {
                    handleData = await handleRepo.getHandleByName(scriptData.handle);
                }

                const { refScriptUtxo, refScriptAddress, cbor } = validateScriptDetails(handleData, scriptData);

                const result: LatestScriptResult = {
                    ...scriptData,
                    scriptAddress,
                    refScriptUtxo,
                    refScriptAddress,
                    cbor
                };

                res.status(handleRepo.getIsCaughtUp() ? 200 : 202).json(result);
                return;
            }

            res.status(handleRepo.getIsCaughtUp() ? 200 : 202).json(allScripts);
        } catch (error) {
            next(error);
        }
    };
}

export default StatsController;
