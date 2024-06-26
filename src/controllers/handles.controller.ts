import { NextFunction, Request, Response } from 'express';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { IGetAllQueryParams, IGetHandleRequest, ISearchBody } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import { HandleSearchModel } from '../models/HandleSearch.model';
import IHandlesRepository from '../repositories/handles.repository';
import { ProtectedWords, AvailabilityResponseCode, checkHandlePattern } from '@koralabs/kora-labs-common';
import { isDatumEndpointEnabled } from '../config';
import { HandleViewModel } from '../models/view/handle.view.model';
import { PersonalizedHandleViewModel } from '../models/view/personalizedHandle.view.model';
import { decodeCborToJson, KeyType } from '../utils/cbor';
import { getScript } from '../config/scripts';
import { HandleReferenceTokenViewModel } from '../models/view/handleReferenceToken.view.model';
import { StoredHandle } from '../repositories/memory/interfaces/handleStore.interfaces';
import { isEmpty } from '../utils/util';

class HandlesController {
    public getAll = async (req: Request<RequestWithRegistry, {}, {}, IGetAllQueryParams>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { records_per_page, sort, page, characters, length, rarity, numeric_modifiers, slot_number, search: searchQuery, holder_address, personalized, og } = req.query;

            const search = new HandleSearchModel({
                characters,
                length,
                rarity,
                numeric_modifiers,
                search: searchQuery,
                holder_address,
                personalized,
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
                res.set('x-handles-search-total', handles.length.toString());
                res.status(handleRepo.currentHttpStatus()).send(handles.join('\n'));
                return;
            }

            let result = await handleRepo.getAll({ pagination, search });

            res.set('x-handles-search-total', result.searchTotal.toString())
                .status(handleRepo.currentHttpStatus())
                .json(result.handles.filter((handle) => !!handle.utxo).map((handle) => new HandleViewModel(handle)));
        } catch (error) {
            next(error);
        }
    };

    public list = async (req: Request<RequestWithRegistry, {}, ISearchBody, IGetAllQueryParams>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { records_per_page, sort, page, characters, length, rarity, numeric_modifiers, slot_number, search: searchQuery, holder_address, personalized, og } = req.query;
            const handles = !isEmpty(req.body) ? req.body : undefined;

            const search = new HandleSearchModel({
                characters,
                length,
                rarity,
                numeric_modifiers,
                search: searchQuery,
                holder_address,
                personalized,
                og,
                handles
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
                res.set('x-handles-search-total', handles.length.toString());
                res.status(handleRepo.currentHttpStatus()).send(handles.join('\n'));
                return;
            }

            let result = await handleRepo.getAll({ pagination, search });
            const handlesViewModel = result.handles.filter((handle) => !!handle.utxo).map((handle) => new HandleViewModel(handle));

            res.set('x-handles-search-total', `${handlesViewModel.length}`).status(handleRepo.currentHttpStatus()).json(handlesViewModel);
        } catch (error) {
            next(error);
        }
    };

    public static getHandleFromRepo = async (handleName: string, handleRepoName: any, asHex = false): Promise<{ code: number; message: string | null; handle: StoredHandle | null }> => {
        const handleRepo = new handleRepoName() as IHandlesRepository;
        let handle: StoredHandle | null = asHex ? await handleRepo.getHandleByHex(handleName) : await handleRepo.getHandleByName(handleName);

        if (!handle) {
            const validHandle = checkHandlePattern(handleName, handleName.includes('@') ? handleName.split('@')[1] : undefined);
            if (!validHandle.valid) {
                return {
                    code: AvailabilityResponseCode.NOT_ACCEPTABLE,
                    message: validHandle.message,
                    handle
                };
            }
            const protectedWordsResult = await ProtectedWords.checkAvailability(handleName);

            if (!protectedWordsResult.available) {
                return {
                    code: protectedWordsResult.code,
                    message: (protectedWordsResult.code === AvailabilityResponseCode.NOT_AVAILABLE_FOR_LEGAL_REASONS ? protectedWordsResult.reason : protectedWordsResult.message) ?? null,
                    handle
                };
            }
            return { code: 404, message: 'Handle not found', handle };
        }
        return { code: handleRepo.currentHttpStatus(), message: null, handle };
    };

    public getHandle = async (req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const handleData = await HandlesController.getHandleFromRepo(req.params.handle, req.params.registry.handlesRepo, req.query.hex == 'true');
            res.status(handleData.code).json(handleData.handle ? new HandleViewModel(handleData.handle) : { message: handleData.message });
        } catch (error) {
            console.log(error);
            next(error);
        }
    };

    public async getPersonalizedHandle(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const handleData = await HandlesController.getHandleFromRepo(req.params.handle, req.params.registry.handlesRepo, req.query.hex == 'true');

            const { personalization } = new PersonalizedHandleViewModel(handleData.handle);

            if (!personalization) {
                res.status(handleData.code).json({});
                return;
            }

            res.status(handleData.code).json(personalization);
        } catch (error) {
            next(error);
        }
    }

    public async getHandleReferenceToken(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const handleData = await HandlesController.getHandleFromRepo(req.params.handle, req.params.registry.handlesRepo, req.query.hex == 'true');

            const { reference_token } = new HandleReferenceTokenViewModel(handleData.handle);

            if (!reference_token) {
                res.status(handleData.code).json({});
                return;
            }
            const scriptData = getScript(reference_token.address);
            if (scriptData) {
                // add to the reference_token the script data
                reference_token.script = scriptData;
            }

            res.status(handleData.code).json(reference_token);
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
            const handleData = await HandlesController.getHandleFromRepo(handleName, req.params.registry.handlesRepo, req.query.hex == 'true');

            if (!handleData.handle) {
                res.status(404).send({ message: 'Handle datum not found' });
                return;
            }

            const handleRepo: IHandlesRepository = new req.params.registry.handlesRepo();

            const handleDatum = await handleRepo.getHandleDatumByName(handleData.handle.name);

            if (!handleDatum) {
                res.status(404).send({ message: 'Handle datum not found' });
                return;
            }

            if (req.headers?.accept?.startsWith('application/json')) {
                try {
                    const decodedDatum = await decodeCborToJson(handleDatum, {}, req.query.default_key_type as KeyType);
                    res.set('Content-Type', 'application/json');
                    res.status(handleRepo.currentHttpStatus()).json(decodedDatum);
                    return;
                } catch (error) {
                    res.status(400).send({ message: 'Unable to decode datum to json' });
                    return;
                }
            }

            res.status(handleRepo.currentHttpStatus()).contentType('text/plain; charset=utf-8').send(handleDatum);
        } catch (error) {
            next(error);
        }
    }

    public async getHandleScript(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const handleData = await HandlesController.getHandleFromRepo(req.params.handle, req.params.registry.handlesRepo, req.query.hex == 'true');

            if (!handleData?.handle) {
                res.status(404).send({ message: 'Handle not found' });
                return;
            }

            if (!handleData.handle.script) {
                res.status(404).send({ message: 'Script not found' });
                return;
            }

            res.status(handleData.code).json(handleData.handle.script);
        } catch (error) {
            next(error);
        }
    }
}

export default HandlesController;
