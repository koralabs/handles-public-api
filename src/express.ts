import App from './app';
import util from 'util'

const app = new App();

util.promisify(app.listen);

Promise.all([app.listen()]);
