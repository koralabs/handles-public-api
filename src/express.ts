import App from './app';
import { registry } from './ioc';

const app = new App(registry);
app.listen();
