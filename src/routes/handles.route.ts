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
        this.router.get(`${this.path}`, this.handlesController.getAll);
        this.router.post(`${this.path}/list`, this.handlesController.list);
        this.router.get(`${this.path}/:handle`, this.handlesController.getHandle);
        this.router.get(`${this.path}/:handle/personalized`, this.handlesController.getPersonalizedHandle);
        this.router.get(`${this.path}/:handle/reference_token`, this.handlesController.getHandleReferenceToken);
        this.router.get(`${this.path}/:handle/utxo`, this.handlesController.getHandleReferenceUTxO);
        this.router.get(`${this.path}/:handle/datum`, this.handlesController.getHandleDatum);
        this.router.get(`${this.path}/:handle/script`, this.handlesController.getHandleScript);
        this.router.get(`${this.path}/:handle/subhandle_settings`, this.handlesController.getSubHandleSettings);
        this.router.get(`${this.path}/:handle/subhandle_settings/utxo`, this.handlesController.getSubHandleSettingsUTxO);
        this.router.get(`${this.path}/:handle/subhandles`, this.handlesController.getSubHandles);
    }
}

export default HandlesRoute;
