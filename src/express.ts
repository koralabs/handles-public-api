import App from './app';
import util from 'util'
console.log(process.env)
const app = new App();
const appPromise = util.promisify(app.listen).bind(app);
Promise.all([appPromise()]);
