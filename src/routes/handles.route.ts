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
        this.router.post(`${this.path}/list`, this.injectRegistryMiddleware, this.handlesController.list);
        this.router.post(`${this.path}/list-from-hashes`, this.injectRegistryMiddleware, this.handlesController.listFromHashes);
        this.router.get(`${this.path}/:handle`, this.injectRegistryMiddleware, this.handlesController.getHandle);
        this.router.get(`${this.path}/:handle/personalized`, this.injectRegistryMiddleware, this.handlesController.getPersonalizedHandle);
        this.router.get(`${this.path}/:handle/reference_token`, this.injectRegistryMiddleware, this.handlesController.getHandleReferenceToken);
        this.router.get(`${this.path}/:handle/utxo`, this.injectRegistryMiddleware, this.handlesController.getHandleReferenceUTxO);
        this.router.get(`${this.path}/:handle/datum`, this.injectRegistryMiddleware, this.handlesController.getHandleDatum);
        this.router.get(`${this.path}/:handle/script`, this.injectRegistryMiddleware, this.handlesController.getHandleScript);
        this.router.get(`${this.path}/:handle/subhandle_settings`, this.injectRegistryMiddleware, this.handlesController.getSubHandleSettings);
        this.router.get(`${this.path}/:handle/subhandle_settings/utxo`, this.injectRegistryMiddleware, this.handlesController.getSubHandleSettingsUTxO);
        this.router.get(`${this.path}/:handle/subhandles`, this.injectRegistryMiddleware, this.handlesController.getSubHandles);
    }
}

export default HandlesRoute;
