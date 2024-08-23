import { Router } from 'express';
import HomeController from '../controllers/home.controller';
import BaseRoute from './base';

class IndexRoute extends BaseRoute {
    public path = '/';
    public router = Router();
    public homeController = new HomeController();

    constructor() {
        super();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(`${this.path}`, this.homeController.index);
    }
}

export default IndexRoute;
