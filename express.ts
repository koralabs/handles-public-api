import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import util from 'util';
import App from './app';
const app = new App();
process.on('uncaughtException', (err) => {
    Logger.log({message: `Uncaught Exception: ${err.message} STACK: ${err.stack}`, category: LogCategory.NOTIFY, event: 'uncaughtException'});
});
process.on('unhandledRejection', (err: Error) => {
    Logger.log({message: `Unhandled Rejection: ${err.message} STACK: ${err.stack}`, category: LogCategory.NOTIFY, event: 'uncaughtException'});
    // Log the error and potentially handle it
});
const appPromise = util.promisify(app.listen).bind(app);
Promise.all([appPromise()]);
