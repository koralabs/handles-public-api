import { Router } from 'express';
import StatsController from '../controllers/stats.controller';
import BaseRoute from './base';

class StatsRoute extends BaseRoute {
    public path = '/stats';
    public router = Router();
    public statsController = new StatsController();

    constructor() {
        super();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(`${this.path}`, this.injectRegistryMiddleware, this.statsController.index);
    }
}

export default StatsRoute;
