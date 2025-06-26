import { HttpException, LogCategory, Logger, ModelException } from '@koralabs/kora-labs-common';
import { NextFunction, Request, Response } from 'express';

const errorMiddleware = (error: HttpException, req: Request, res: Response, next: NextFunction) => {
    try {
        let status = 500;
        const message: string = error.message || 'Something went wrong';
        if (error instanceof ModelException) {
            status = 400;
        } else if (error instanceof HttpException) {
            status = error.status;
        }
        if (status >= 500) {
            Logger.log({
                message: `[${req.method}] ${req.path} >> StatusCode:: ${status}, Message:: ${message}, Stack: ${error.stack}`,
                category: LogCategory.ERROR,
                event: 'http.exception'
            });
        }
        res.status(status).json({ message });
    } catch (error) {
        next(error);
    }
};

export default errorMiddleware;
