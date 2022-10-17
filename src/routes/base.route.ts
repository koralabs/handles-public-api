import { NextFunction, Router, Response, Request } from 'express';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { Routes } from '../interfaces/routes.interface';
import { IRegistry } from '../ioc';

import { registry } from '../ioc';

class BaseRoute implements Routes {
    public router = Router();
    public registry: IRegistry;

    constructor() {
        this.registry = registry;
    }

    injectRegistryMiddleware = (req: Request<RequestWithRegistry, {}, {}>, res: Response, next: NextFunction) => {
        req.params.registry = this.registry;
        next();
    };
}

export default BaseRoute;
