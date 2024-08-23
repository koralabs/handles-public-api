import { Router } from 'express';
import HealthController from '../controllers/health.controller';
import BaseRoute from './base';

class HealthRoute extends BaseRoute {
    public path = '/health';
    public router = Router();
    public healthController = new HealthController();

    constructor() {
        super();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(`${this.path}`, this.healthController.index);
    }
}

export default HealthRoute;
