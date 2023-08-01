import { NextFunction, Request, Response } from 'express';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { IGetAllQueryParams, IGetHandleRequest } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import { HandleSearchModel } from '../models/HandleSearch.model';
import IHandlesRepository from '../repositories/handles.repository';
import ProtectedWords from '@koralabs/protected-words';
import { AvailabilityResponseCode } from '@koralabs/protected-words/lib/interfaces';
import { isDatumEndpointEnabled } from '../config';
import { HandleViewModel } from '../models/view/handle.view.model';
import { PersonalizedHandleViewModel } from '../models/view/personalizedHandle.view.model';
import { decodeCborToJson } from '../utils/cbor';
import { handleDatumSchema } from '../utils/cbor/schema/handleData';
import { getScript } from '../config/scripts';
import { validateScriptDetails } from '../utils/util';

class HandlesController {
    public getAll = async (
        req: Request<RequestWithRegistry, {}, {}, IGetAllQueryParams>,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const {
                records_per_page,
                sort,
                page,
                characters,
                length,
                rarity,
                numeric_modifiers,
                slot_number,
                search: searchQuery,
                holder_address,
                og
            } = req.query;

            const search = new HandleSearchModel({
                characters,
                length,
                rarity,
                numeric_modifiers,
                search: searchQuery,
                holder_address,
                og
            });

            const pagination = new HandlePaginationModel({
                page,
                sort,
                handlesPerPage: records_per_page,
                slotNumber: slot_number
            });

            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();

            if (req.headers?.accept?.startsWith('text/plain')) {
                const { sort: sortParam } = pagination;
                const handles = await handleRepo.getAllHandleNames(search, sortParam);
                res.set('Content-Type', 'text/plain; charset=utf-8');
                res.status(handleRepo.getIsCaughtUp() ? 200 : 202).send(handles.join('\n'));
                return;
            }

            const handles = await handleRepo.getAll({ pagination, search });
            res.status(handleRepo.getIsCaughtUp() ? 200 : 202).json(
                handles.filter((handle) => !!handle.utxo).map((handle) => new HandleViewModel(handle))
            );
        } catch (error) {
            next(error);
        }
    };

    public getHandle = async (
        req: Request<IGetHandleRequest, {}, {}>,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const handleName = req.params.handle;
            const protectedWordsResult = await ProtectedWords.checkAvailability(handleName);
            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            const handleData = await handleRepo.getHandleByName(handleName);

            if (!handleData && !protectedWordsResult.available) {
                res.status(protectedWordsResult.code).send({
                    message:
                        protectedWordsResult.code === AvailabilityResponseCode.NOT_AVAILABLE_FOR_LEGAL_REASONS
                            ? protectedWordsResult.reason
                            : protectedWordsResult.message
                });
                return;
            }

            if (!handleData) {
                res.status(404).send({ message: 'Handle not found' });
                return;
            }

            res.status(handleRepo.getIsCaughtUp() ? 200 : 202).json(new HandleViewModel(handleData));
        } catch (error) {
            next(error);
        }
    };

    public async getPersonalizedHandle(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const handleName = req.params.handle;
            const protectedWordsResult = await ProtectedWords.checkAvailability(handleName);
            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            const handleData = await handleRepo.getHandleByName(handleName);

            if (!handleData && !protectedWordsResult.available) {
                res.status(protectedWordsResult.code).send({
                    message:
                        protectedWordsResult.code === AvailabilityResponseCode.NOT_AVAILABLE_FOR_LEGAL_REASONS
                            ? protectedWordsResult.reason
                            : protectedWordsResult.message
                });
                return;
            }

            if (!handleData) {
                res.status(404).send({ message: 'Handle not found' });
                return;
            }

            const { personalization } = new PersonalizedHandleViewModel(handleData);

            if (!personalization) {
                res.status(handleRepo.getIsCaughtUp() ? 200 : 202).json({});
                return;
            }

            const scriptData = getScript(personalization.reference_token.address);
            if (scriptData) {
                const scriptHandle = await handleRepo.getHandleByName(scriptData.handle);

                const { refScriptUtxo, refScriptAddress, cbor } = validateScriptDetails(scriptHandle, scriptData);

                // add to the reference_token the script data
                personalization.reference_token.script = {
                    ...scriptData,
                    refScriptUtxo,
                    refScriptAddress,
                    cbor
                };
            }

            res.status(handleRepo.getIsCaughtUp() ? 200 : 202).json(personalization);
        } catch (error) {
            next(error);
        }
    }

    public async getHandleDatum(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            if (!isDatumEndpointEnabled()) {
                res.status(400).send({ message: 'Datum endpoint is disabled' });
                return;
            }

            const handleName = req.params.handle;
            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            const handleDatum = await handleRepo.getHandleDatumByName(handleName);

            if (!handleDatum) {
                res.status(404).send({ message: 'Handle datum not found' });
                return;
            }

            if (req.headers?.accept?.startsWith('application/json')) {
                try {
                    const decodedDatum = await decodeCborToJson(handleDatum, handleDatumSchema);
                    res.set('Content-Type', 'application/json');
                    res.status(handleRepo.getIsCaughtUp() ? 200 : 202).json(decodedDatum);
                    return;
                } catch (error) {
                    res.status(400).send({ message: 'Unable to decode datum to json' });
                    return;
                }
            }

            res.status(handleRepo.getIsCaughtUp() ? 200 : 202)
                .contentType('text/plain; charset=utf-8')
                .send(handleDatum);
        } catch (error) {
            next(error);
        }
    }

    public async getHandleScript(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const handleName = req.params.handle;
            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();
            const handle = await handleRepo.getHandleByName(handleName);

            if (!handle) {
                res.status(404).send({ message: 'Handle not found' });
                return;
            }

            if (!handle.script) {
                res.status(404).send({ message: 'Script not found' });
                return;
            }

            res.status(handleRepo.getIsCaughtUp() ? 200 : 202).json(handle.script);
        } catch (error) {
            next(error);
        }
    }
}

export default HandlesController;
