import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { NODE_ENV, PORT, ORIGIN, CREDENTIALS } from './config';
import { Routes } from './interfaces/routes.interface';
import errorMiddleware from './middlewares/error.middleware';
import { HandleStore } from './repositories/memory/HandleStore';
import OgmiosService from './services/ogmios/ogmios.service';
import { Logger } from './utils/logger';
import swaggerDoc from './swagger/swagger.json';
import { writeConsoleLine } from './utils/util';

class App {
    public app: express.Application;
    public env: string;
    public port: string | number;
    public startTimer: number;

    constructor(routes: Routes[]) {
        this.app = express();
        this.env = NODE_ENV || 'development';
        this.port = PORT || 3141;
        this.startTimer = Date.now();

        this.initializeMiddleware();
        this.initializeRoutes(routes);
        this.initializeErrorHandling();
        this.initializeSwagger();

        if (this.env === 'development') {
            this.initializeMockStorage();
        } else {
            this.initializeStorage();
        }
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

    private initializeRoutes(routes: Routes[]) {
        routes.forEach((route) => {
            this.app.use('/', route.router);
        });
    }

    private initializeErrorHandling() {
        this.app.use(errorMiddleware);
    }

    private async initializeStorage() {
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
