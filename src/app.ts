import cors from 'cors';
import fs from 'fs';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { NODE_ENV, PORT, ORIGIN, CREDENTIALS } from './config';
import { Routes } from './interfaces/routes.interface';
import errorMiddleware from './middlewares/error.middleware';
import { HandleStore } from './repositories/memory/HandleStore';
import OgmiosService from './services/ogmios/ogmios.service';
import { Logger } from './utils/logger';
import swaggerDoc from './swagger/swagger.json';
import { dynamicallyLoad, writeConsoleLine } from './utils/util';
import { DynamicLoadType } from './interfaces/util.interface';

class App {
    public app: express.Application;
    public env: string;
    public port: string | number;
    public startTimer: number;

    constructor() {
        this.app = express();
        this.env = NODE_ENV || 'development';
        this.port = PORT || 3141;
        this.startTimer = Date.now();

        this.initializeMiddleware();
        this.initializeDynamicHandlers();
        this.initializeStorage();
    }

    public listen() {
        this.app.listen(this.port, () => {
            Logger.log(`=========================================`);
            Logger.log(`============ENV: ${this.env} ============`);
            Logger.log(`🚀 App listening on the port ${this.port}`);
            Logger.log(`=========================================`);
        });
    }

    public getServer() {
        return this.app;
    }

    private initializeMiddleware() {
        this.app.use(cors({ origin: ORIGIN, credentials: CREDENTIALS }));
        this.app.use(express.text());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    private async initializeDynamicHandlers() {
        this.initializeSwagger();

        const middlewares = await dynamicallyLoad(`${__dirname}/middlewares`, DynamicLoadType.MIDDLEWARE);
        middlewares.forEach((middleware) => {
            this.app.use(middleware);
        });

        const routes = await dynamicallyLoad(`${__dirname}/routes`, DynamicLoadType.ROUTE);
        this.initializeRoutes(routes);

        this.app.use(errorMiddleware);
    }

    private initializeRoutes(routes: Routes[]) {
        routes.forEach((route) => {
            this.app.use('/', route.router);
        });
    }

    private async initializeStorage() {
        if (this.env === 'development') {
            this.initializeMockStorage();
            return;
        }

        const startOgmios = async () => {
            try {
                const ogmiosService = new OgmiosService();
                await ogmiosService.startSync();
                clearInterval(interval);
            } catch (error: any) {
                writeConsoleLine(this.startTimer, `Trying to start Ogmios: ${error.message}`);
            }
        };

        const interval = setInterval(async () => {
            await startOgmios();
        }, 30000);

        await startOgmios();
    }

    private async initializeMockStorage() {
        Logger.log('Initializing Mock Storage');
        HandleStore.buildStorage();
    }

    private async initializeSwagger() {
        var options = {
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'Handle API',
            customfavIcon: '/assets/favicon.ico'
        };

        this.app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDoc, options));
    }
}

export default App;
