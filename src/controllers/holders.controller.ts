import { NextFunction, Request, Response } from 'express';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { IGetAllHoldersQueryParams, IGetHolderAddressDetailsRequest } from '../interfaces/handle.interface';
import { HolderPaginationModel } from '../models/holderPagination.model';
import IHandlesRepository from '../repositories/handles.repository';

class HoldersController {
    public getAll = async (
        req: Request<RequestWithRegistry, {}, {}, IGetAllHoldersQueryParams>,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const {
                records_per_page,
                sort,
                page,
            } = req.query;

            const pagination = new HolderPaginationModel({
                page,
                sort,
                recordsPerPage: records_per_page
            });

            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
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
            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            const details = await handleRepo.getHolderAddressDetails(holderAddress);

            res.status(handleRepo.currentHttpStatus()).json(details);
        } catch (error) {
            next(error);
        }
    }
}

export default HoldersController;
