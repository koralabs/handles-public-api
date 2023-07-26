import { NextFunction, Request, Response } from 'express';
import IHandlesRepository from '../repositories/handles.repository';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { HandleStore } from '../repositories/memory/HandleStore';
import { scripts } from '../config/scripts';

class StatsController {
    public index = async (req: Request<RequestWithRegistry>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { latest = false } = req.query;

            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();

            const allScripts = scripts[process.env.NETWORK ?? 'preview'];

            if (latest) {
                const latestScript = Object.entries(scripts[process.env.NETWORK ?? 'preview']).find(
                    ([_, value]) => value.latest
                );

                if (!latestScript) {
                    // send a 404 if no latest script is found
                    res.status(404).send({ message: 'Latest script not found' });
                    return;
                }

                const [scriptAddress, scriptData] = latestScript;

                const handleData = await handleRepo.getHandleByName(scriptData.handle);

                if (!latestScript) {
                    // send a 404 if no latest script is found
                    res.status(404).send({ message: `${scriptData.handle} not found` });
                    return;
                }

                const result = {
                    output: {
                        utxo: handleData?.utxo,
                        address: handleData?.resolved_addresses?.ada
                    },
                    scriptAddress,
                    ...scriptData
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
