import { NextBlockResponse } from '@cardano-ogmios/schema';
import { Logger } from '@koralabs/kora-labs-common';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';
import { CREDENTIALS, NODE_ENV, ORIGIN, PORT } from './config';
import { IBlockProcessor } from './interfaces/ogmios.interfaces';
import { IRegistry } from './interfaces/registry.interface';
import { DynamicLoadType } from './interfaces/util.interface';
import errorMiddleware from './middlewares/error.middleware';
import { HandlesRepository } from './repositories/handlesRepository';
import OgmiosService from './services/ogmios/ogmios.service';
import { dynamicallyLoad } from './utils/util';

class App {
    public app: express.Application;
    public env: string;
    public port: string | number;
    public startTimer: number;
    public registry: IRegistry;
    public blockProcessors: IBlockProcessor[] = [];

    constructor() {
        this.app = express();
        this.registry = {} as IRegistry;
        this.env = NODE_ENV || 'development';
        this.port = PORT || 3141;
        this.startTimer = Date.now();
    }

    private _getDynamicLoadDirectories(): string[] {
        if ((this.env == 'development' || this.env == 'test') && process.env.DYNAMIC_LOAD_DIR) {
            return ['./', ...process.env.DYNAMIC_LOAD_DIR.split(';')];
        }
        return ['./'];
    }

    public async listen() {
        await this.initialize();
        const server = this.app.listen(this.port, () => {
            Logger.log(`🚀 ${this.env} app listening on port ${this.port}`);
        });
        server.keepAliveTimeout = 61 * 1000;
    }

    public async initialize() {
        this.initializeMiddleware();
        await this.initializeDynamicHandlers();
        this.app.use(errorMiddleware);
        this.initializeOgmios();
        return this;
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

        for (let i = 0; i < dirs.length; i++) {
            const dir = dirs[i];
            const middlewares = await dynamicallyLoad(path.resolve(`${dir}/middlewares`), DynamicLoadType.MIDDLEWARE);
            middlewares.forEach((middleware) => {
                this.app.use(middleware);
            });

            const routes = await dynamicallyLoad(path.resolve(`${dir}/routes`), DynamicLoadType.ROUTE);
            routes.forEach((route) => {
                this.app.use('/', route.router);
            });

            const registries = await dynamicallyLoad(path.resolve(`${dir}/ioc`), DynamicLoadType.REGISTRY);
            registries.forEach((registry: IRegistry) => {
                for (const [key, value] of Object.entries(registry)) {
                    this.registry[key] = value;
                }
            });

            const processors = await dynamicallyLoad(path.resolve(`${dir}/block_processors`), DynamicLoadType.BLOCK_PROCESSOR);
            for (let i = 0; i < processors.length; i++) {
                const processor = processors[i] as IBlockProcessor;
                this.blockProcessors.push(await processor.initialize(this.registry));
            }
        }
        this.app.set('registry', this.registry);
    }

    public async processBlock(block: NextBlockResponse) {
        if (this.blockProcessors.length > 0) {
            for (let i = 0; i < this.blockProcessors.length; i++) {
                await this.blockProcessors[i].processBlock(block);
            }
        }
    }

    private async loadBlockProcessorIndexes() {
        if (this.blockProcessors.length > 0) {
            for (let i = 0; i < this.blockProcessors.length; i++) {
                await this.blockProcessors[i].loadIndexes();
            }
        }
    }

    private async resetBlockProcessors() {        
        // loop through registries and clear out storage and file
        const handlesRepo = new HandlesRepository(this.registry.handlesRepo());
        handlesRepo.rollBackToGenesis();
        
        if (this.blockProcessors.length > 0) {
            for (let i = 0; i < this.blockProcessors.length; i++) {
                await this.blockProcessors[i].resetIndexes();
            }
        }
    }

    private async initializeOgmios() {
        if (this.env === 'test') {
            return;
        }

        const handlesRepo = new HandlesRepository(this.registry.handlesRepo());
        const ogmiosService = new OgmiosService(handlesRepo, this.processBlock);
        await ogmiosService.initialize(this.resetBlockProcessors, this.loadBlockProcessorIndexes);
    }

    private async initializeSwagger() {
        const options = {
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'Handles API',
            customfavIcon: '/assets/favicon.ico'
        };

        try {
            const swaggerDoc = parse(fs.readFileSync('./swagger.yml').toString());
            // @ts-expect-error
            this.app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDoc, options));
        } catch (error: any) {
            Logger.log(`Unable to load swagger with error: ${error}`);
        }
    }
}

export default App;
