import { validatePlaintextStartup } from '../utils/startupEnvironment';

export const handler = async (event: AWSLambda.ALBEvent, context: AWSLambda.Context) => {
    await validatePlaintextStartup();
    const { handler: appHandler } = await import('./api.app');
    return appHandler(event, context);
};
