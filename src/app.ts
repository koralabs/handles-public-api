import path from 'path';
import cors from 'cors';
import { Logger, LogCategory } from '@koralabs/kora-labs-common';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import { NODE_ENV, PORT, ORIGIN, CREDENTIALS } from './config';
import { Routes } from './interfaces/routes.interface';
import errorMiddleware from './middlewares/error.middleware';
import OgmiosService from './services/ogmios/ogmios.service';
import { delay, dynamicallyLoad } from './utils/util';
import { DynamicLoadType } from './interfaces/util.interface';
import { LocalService } from './services/local/local.service';
import { IRegistry } from './ioc';

class App {
    public app: express.Application;
    public env: string;
    public port: string | number;
    public startTimer: number;
    public registry: IRegistry;

    constructor(registry: IRegistry) {
        this.app = express();
        this.app.set("registry", registry)
        this.registry = registry;
        this.env = NODE_ENV || 'development';
        this.port = PORT || 3141;
        this.startTimer = Date.now();

        this.initializeMiddleware();
        this.initializeDynamicHandlers();
    }

    private _getDynamicLoadDirectories(): string[] {
        if (this.env == 'development' && process.env.DYNAMIC_LOAD_DIR) {
            return [__dirname, ...process.env.DYNAMIC_LOAD_DIR.split(';')];
        }
        return [__dirname]; 
    }

    public listen() {
        const server = this.app.listen(this.port, () => {
            Logger.log(`🚀 ${this.env} app listening on port ${this.port}`);
        });
        server.keepAliveTimeout = 61 * 1000;
        this.initializeStorage();
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
        const dirs = this._getDynamicLoadDirectories();
        for(let i=0;i<dirs.length;i++) {
            const dir = dirs[i];
            const middlewares = await dynamicallyLoad(path.resolve(`${dir}/middlewares`), DynamicLoadType.MIDDLEWARE);
            middlewares.forEach((middleware) => {
                this.app.use(middleware);
            });

            const routes = await dynamicallyLoad(path.resolve(`${dir}/routes`), DynamicLoadType.ROUTE);
            this.initializeRoutes(routes); 
        }

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

        if (this.env === 'local') {
            const localService = new LocalService();
            localService.startSync();
            return;
        }

        const startOgmios = async () => {
            let ogmiosStarted = false;
            let loadS3 = true;
            while (!ogmiosStarted) {
                try {
                    const ogmiosService = new OgmiosService(this.registry.handlesRepo(), loadS3);
                    await ogmiosService.startSync();
                    ogmiosStarted = true;
                } catch (error: any) {
                    if (error.code === 1000) {
                        loadS3 = false;
                    }
                    Logger.log({
                        message: `Unable to start Ogmios: ${error.message}`,
                        category: LogCategory.ERROR,
                        event: 'startOgmios.failed.errorMessage'
                    });
                    // Logger.log({
                    //     message: `Error: ${JSON.stringify(error)}`,
                    //     category: LogCategory.INFO,
                    //     event: 'startOgmios.failed.error'
                    // });
                    await delay(30 * 1000);
                }
            }
        };

        await startOgmios();
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
