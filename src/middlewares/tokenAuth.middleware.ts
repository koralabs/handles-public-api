import { NextFunction, Response, Request } from 'express';
import { HttpException } from '../exceptions/HttpException';
import { RequestWithRegistry } from '../interfaces/auth.interface';

export const tokenAuthMiddleware = async (req: Request<RequestWithRegistry>, res: Response, next: NextFunction) => {
    try {
        const apiKey = req.header('api-key');
        if (apiKey) {
            const apiKeysRepo = new req.params.registry.apiKeysRepo();
            const foundKey = await apiKeysRepo.get(apiKey);
            if (foundKey) {
                next();
            } else {
                next(new HttpException(401, 'Wrong authentication token'));
            }
        } else {
            next(new HttpException(404, 'Missing api-key'));
        }
    } catch (error) {
        next(new HttpException(401, 'Wrong api-key'));
    }
};

export default tokenAuthMiddleware;
