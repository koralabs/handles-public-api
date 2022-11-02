import HandlesController from '../controllers/handles.controller';
import BaseRoute from './base';

class HandlesRoute extends BaseRoute {
    public path = '/handles';
    public handlesController = new HandlesController();

    constructor() {
        super();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(`${this.path}`, this.injectRegistryMiddleware, this.handlesController.getAll);
        this.router.get(`${this.path}/:handle`, this.injectRegistryMiddleware, this.handlesController.getHandle);
    }
}

export default HandlesRoute;
