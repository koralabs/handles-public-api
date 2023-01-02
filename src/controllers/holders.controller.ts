import { NextFunction, Request, Response } from 'express';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { IGetHolderAddressDetailsRequest } from '../interfaces/handle.interface';
import IHandlesRepository from '../repositories/handles.repository';

class HoldersController {
    public getAll = async (
        req: Request<RequestWithRegistry, {}, {}, {}>,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            res.status(200).json({ message: 'Coming Soon' });
        } catch (error) {
            next(error);
        }
    };

    public async getHolderAddressDetails(
        req: Request<IGetHolderAddressDetailsRequest, {}, {}>,
        res: Response,
        next: NextFunction
    ) {
        try {
            const holderAddress = req.params.address;
            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            const details = await handleRepo.getHolderAddressDetails(holderAddress);

            res.status(handleRepo.getIsCaughtUp() ? 200 : 202).json(details);
        } catch (error) {
            next(error);
        }
    }
}

export default HoldersController;
