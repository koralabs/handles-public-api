import cors from 'cors';
import { Logger } from '@koralabs/kora-labs-common';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import { NODE_ENV, PORT, ORIGIN, CREDENTIALS } from './config';
import { Routes } from './interfaces/routes.interface';
import errorMiddleware from './middlewares/error.middleware';
import { HandleStore } from './repositories/memory/HandleStore';
import OgmiosService from './services/ogmios/ogmios.service';
import { dynamicallyLoad, writeConsoleLine } from './utils/util';
import { DynamicLoadType } from './interfaces/util.interface';
import { LocalService } from './services/local/local.service';
import { loadCardanoWasm } from './utils/serialization';

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
        loadCardanoWasm();
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
        if (this.env === 'test') {
            return;
        }

        if (this.env === 'development') {
            this.initializeMockStorage();
            return;
        }

        if (this.env === 'local') {
            const localService = new LocalService();
            localService.startSync();
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
        await HandleStore.buildStorage();
    }

    private async initializeSwagger() {
        var options = {
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'Handles API',
            customfavIcon: '/assets/favicon.ico'
        };

        try {
            const swaggerDoc = yaml.load(`${__dirname}/swagger.yml`);
            this.app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDoc, options));
        } catch (error: any) {
            Logger.log(`Unable to load swagger with error ${error.message}`);
        }
    }
}

export default App;
