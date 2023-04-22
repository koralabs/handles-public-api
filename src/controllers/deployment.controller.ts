import { NextFunction, Request, Response } from 'express';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import * as fs from 'fs'

class DeploymentController {
    public index = async (req: Request<RequestWithRegistry>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const deploymentJson = JSON.parse(fs.readFileSync('deployment_info.json').toString());
            res.status(200).json(deploymentJson);
        } catch (error) {
            next(error);
        }
    };
}

export default DeploymentController;
