import { HolderPaginationModel, IGetAllHoldersQueryParams, IGetHolderAddressDetailsRequest, IHandlesRepository } from '@koralabs/kora-labs-common';
import { NextFunction, Request, Response } from 'express';
import { IRegistry } from '../interfaces/registry.interface';

class HoldersController {
    public getAll = async (
        req: Request<Request, {}, {}, IGetAllHoldersQueryParams>,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const {
                records_per_page,
                sort,
                page
            } = req.query;

            const pagination = new HolderPaginationModel({
                page,
                sort,
                recordsPerPage: records_per_page
            });

            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();
            const holders = await handleRepo.getAllHolders({ pagination });
            res.status(handleRepo.currentHttpStatus()).json(holders);
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
            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();
            const details = await handleRepo.getHolderAddressDetails(holderAddress);

            res.status(handleRepo.currentHttpStatus()).json(details);
        } catch (error) {
            next(error);
        }
    }
}

export default HoldersController;
