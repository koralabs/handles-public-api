import { NextFunction, Request, Response } from 'express';
import { HttpException } from '../exceptions/HttpException';
import { ModelException } from '../exceptions/ModelException';
import { LogCategory, Logger } from '../utils/logger';

const errorMiddleware = (error: HttpException, req: Request, res: Response, next: NextFunction) => {
    try {
        let status = 500;
        const message: string = error.message || 'Something went wrong';
        if (error instanceof ModelException) {
            status = 400;
        } else if (error instanceof HttpException) {
            status = error.status;
        }

        Logger.log(`[${req.method}] ${req.path} >> StatusCode:: ${status}, Message:: ${message}`, LogCategory.ERROR);
        res.status(status).json({ message });
    } catch (error) {
        next(error);
    }
};

export default errorMiddleware;
