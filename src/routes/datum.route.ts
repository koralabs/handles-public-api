import { Router } from 'express';
import DatumController from '../controllers/datum.controller';
import BaseRoute from './base';

class DatumRoute extends BaseRoute {
    public path = '/datum';
    public router = Router();
    public datumController = new DatumController();

    constructor() {
        super();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(`${this.path}`, this.datumController.convert);
    }
}

export default DatumRoute;
