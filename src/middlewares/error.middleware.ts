import { LogCategory, Logger } from '@koralabs/logger';
import { NextFunction, Request, Response } from 'express';
import { HttpException } from '../exceptions/HttpException';
import { ModelException } from '../exceptions/ModelException';

const errorMiddleware = (error: HttpException, req: Request, res: Response, next: NextFunction) => {
    try {
        let status = 500;
        const message: string = error.message || 'Something went wrong';
        if (error instanceof ModelException) {
            status = 400;
        } else if (error instanceof HttpException) {
            status = error.status;
        }

        Logger.log({
            message: `[${req.method}] ${req.path} >> StatusCode:: ${status}, Message:: ${message}`,
            category: LogCategory.ERROR,
            event: 'middleware.error'
        });
        res.status(status).json({ message });
    } catch (error) {
        next(error);
    }
};

export default errorMiddleware;
