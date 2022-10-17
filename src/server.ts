import App from './app';
import IndexRoute from './routes/index.route';
import HandlesRoute from './routes/handles.route';
import HealthRoute from './routes/health.route';

const app = new App([new IndexRoute(), new HealthRoute(), new HandlesRoute()]);

export default app;
