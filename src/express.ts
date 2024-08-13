import App from './app';
import util from 'util'
const app = new App();
const appPromise = util.promisify(app.listen).bind(app);
Promise.all([appPromise()]);
