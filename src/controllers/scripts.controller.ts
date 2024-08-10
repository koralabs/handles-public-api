import { NextFunction, Request, Response } from 'express';
import IHandlesRepository from '../repositories/handles.repository';
import { scripts } from '../config/scripts';
import { LatestScriptResult } from '../interfaces/scripts.interface';
import { IRegistry } from '../interfaces/registry.interface';;
import { ScriptDetails, ScriptType } from '@koralabs/kora-labs-common';

class ScriptsController {
    public index = async (req: Request<Request>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { latest = false, type = null } = req.query;

            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();

            const network = process.env.NETWORK ?? 'preview';
            const allScripts = type ? Object.entries(scripts[network]).filter(([_, value]) => value.type === type) : Object.entries(scripts[network]);

            if (latest) {
                const latestScript = allScripts.find(([_, value]) => value.latest && (type ? value.type === type : value.type === ScriptType.PZ_CONTRACT));

                if (!latestScript) {
                    // send a 404 if no latest script is found
                    res.status(404).send({ message: 'Latest script not found' });
                    return;
                }

                const [scriptAddress, scriptData] = latestScript;
                const result: LatestScriptResult = {
                    ...scriptData,
                    scriptAddress
                };

                res.status(handleRepo.currentHttpStatus()).json(result);
                return;
            }

            res.status(handleRepo.currentHttpStatus()).json(
                allScripts.reduce<{ [scriptAddress: string]: ScriptDetails }>((acc, [key, value]) => {
                    acc[key] = value;
                    return acc;
                }, {})
            );
        } catch (error) {
            next(error);
        }
    };
}

export default ScriptsController;
