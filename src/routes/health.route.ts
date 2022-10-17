import { Router } from 'express';
import HealthController from '../controllers/health.controller';
import { Routes } from '../interfaces/routes.interface';

class HealthRoute implements Routes {
    public path = '/health';
    public router = Router();
    public healthController = new HealthController();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(`${this.path}`, this.healthController.index);
    }
}

export default HealthRoute;
