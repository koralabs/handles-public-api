import { Router } from 'express';
import { Routes } from '../interfaces/routes.interface';

class BaseRoute implements Routes {
    public router = Router();
    public path = '/';
}

export default BaseRoute;
