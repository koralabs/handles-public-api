import HandlesController from '../controllers/handles.controller';
import tokenAuthMiddleware from '../middlewares/tokenAuth.middleware';
import BaseRoute from './base.route';

class HandlesRoute extends BaseRoute {
    public path = '/handles';
    public handlesController = new HandlesController();

    constructor() {
        super();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(
            `${this.path}`,
            this.injectRegistryMiddleware,
            //tokenAuthMiddleware,
            this.handlesController.getAll
        );
        this.router.get(
            `${this.path}/:handle`,
            this.injectRegistryMiddleware,
            // tokenAuthMiddleware,
            this.handlesController.getHandle
        );
    }
}

export default HandlesRoute;
