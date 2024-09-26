import {
    AvailabilityResponseCode,
    bech32FromHex,
    checkHandlePattern,
    HandlePaginationModel, HandleSearchModel,
    HandleType,
    IHandlesRepository,
    IReferenceToken,
    IS_PRODUCTION,
    isEmpty,
    ISubHandleSettings,
    ISubHandleTypeSettings,
    parseAssetNameLabel,
    ProtectedWords,
    StoredHandle
} from '@koralabs/kora-labs-common';
import { decodeCborToJson, DefaultTextFormat, subHandleSettingsDatumSchema } from '@koralabs/kora-labs-common/utils/cbor';
import { NextFunction, Request, Response } from 'express';
import { isDatumEndpointEnabled } from '../config';
import { IRegistry } from '../interfaces/registry.interface';
import { IGetAllQueryParams, IGetHandleRequest, ISearchBody } from '../interfaces/request.interface';
import { HandleViewModel } from '../models/view/handle.view.model';
import { HandleReferenceTokenViewModel } from '../models/view/handleReferenceToken.view.model';
import { PersonalizedHandleViewModel } from '../models/view/personalizedHandle.view.model';

class HandlesController {
    private static getHandleFromRepo = async (req: Request<IGetHandleRequest, {}, {}>): Promise<{ code: number; message: string | null; handle: StoredHandle | null }> => {
        const handleName = req.params.handle;
        const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();
        const asHex = req.query.hex == 'true';
        const handle: StoredHandle | null = asHex ? await handleRepo.getHandleByHex(handleName) : await handleRepo.getHandleByName(handleName);

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

    public getAll = async (req: Request<Request, {}, {}, IGetAllQueryParams>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { records_per_page, page, characters, length, rarity, numeric_modifiers, slot_number, search: searchQuery, holder_address, og, handle_type, sort, personalized } = req.query;

            const search = new HandleSearchModel({
                characters,
                length,
                rarity,
                numeric_modifiers,
                search: searchQuery,
                holder_address,
                personalized,
                handle_type,
                og
            });

            const pagination = new HandlePaginationModel({
                page,
                sort,
                handlesPerPage: records_per_page,
                slotNumber: slot_number
            });

            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();

            if (req.headers?.accept?.startsWith('text/plain')) {
                const { sort: sortParam } = pagination;
                const handles = await handleRepo.getAllHandleNames(search, sortParam);
                res.set('Content-Type', 'text/plain; charset=utf-8');
                res.set('x-handles-search-total', handles.length.toString());
                res.status(handleRepo.currentHttpStatus()).send(handles.join('\n'));
                return;
            }

            const result = await handleRepo.getAll({ pagination, search });

            res.set('x-handles-search-total', result.searchTotal.toString())
                .status(handleRepo.currentHttpStatus())
                .json(result.handles.filter((handle) => !!handle.utxo).map((handle) => new HandleViewModel(handle)));
        } catch (error) {
            next(error);
        }
    };

    private _searchFromList = async (req: Request<Request, {}, ISearchBody, IGetAllQueryParams>, res: Response, next: NextFunction, handles?: ISearchBody): Promise<void> => {
        const { records_per_page, sort, page, characters, length, rarity, numeric_modifiers, slot_number, search: searchQuery, holder_address, personalized, og, handle_type } = req.query;

        const search = new HandleSearchModel({
            characters,
            length,
            rarity,
            numeric_modifiers,
            search: searchQuery,
            holder_address,
            personalized,
            og,
            handle_type,
            handles
        });

        const pagination = new HandlePaginationModel({
            page,
            sort,
            handlesPerPage: records_per_page,
            slotNumber: slot_number
        });

        const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();

        if (req.headers?.accept?.startsWith('text/plain')) {
            const { sort: sortParam } = pagination;
            const handles = await handleRepo.getAllHandleNames(search, sortParam);
            res.set('Content-Type', 'text/plain; charset=utf-8');
            res.set('x-handles-search-total', handles.length.toString());
            res.status(handleRepo.currentHttpStatus()).send(handles.join('\n'));
            return;
        }

        const result = await handleRepo.getAll({ pagination, search });
        const handlesViewModel = result.handles.filter((handle) => !!handle.utxo).map((handle) => new HandleViewModel(handle));

        res.set('x-handles-search-total', `${handlesViewModel.length}`).status(handleRepo.currentHttpStatus()).json(handlesViewModel);
    }

    public list = async (req: Request<Request, {}, ISearchBody, IGetAllQueryParams>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();
            let handles: string[] = !isEmpty(req.body) ? req.body as string[] : [];
            switch (req.query.type) {
                case 'bech32stake':
                case 'holder':
                    handles = handleRepo.getHandlesByHolderAddresses(handles)
                    break;
                case 'stakekeyhash':
                    handles = handleRepo.getHandlesByHolderAddresses(handles.map(hash => bech32FromHex(hash, !IS_PRODUCTION , 'stake')))
                    break;
                case 'assetname':
                    handles = handles.map(name => Buffer.from(parseAssetNameLabel(name) ? name.slice(8) : name, 'hex').toString('utf8'));
                    break;
                case 'handlehex':
                    handles = handles.map(hex => Buffer.from(hex, 'hex').toString('utf8'));
                    break;
                case 'paymentkeyhash':
                    handles = handleRepo.getHandlesByPaymentKeyHashes(handles)
                    break;
                case 'bech32address':
                    handles = handleRepo.getHandlesByAddresses(handles)
                    break;
                case 'hexaddress':
                    handles = handleRepo.getHandlesByAddresses(handles.map(hex => bech32FromHex(hex)))
                    break;
                default:
                    break;
            }
            await this._searchFromList(req, res, next, handles);
        } catch (error) {
            next(error);
        }
    };

    public getHandle = async (req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction): Promise<void> => {
        try {
            const handleData = await HandlesController.getHandleFromRepo(req);
            res.status(handleData.code).json(handleData.handle ? new HandleViewModel(handleData.handle) : { message: handleData.message });
        } catch (error) {
            next(error);
        }
    };

    public async getPersonalizedHandle(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const handleData = await HandlesController.getHandleFromRepo(req);

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

    private static async buildHandleReferenceToken(req: Request<IGetHandleRequest, {}, {}>): Promise<{ reference_token?: IReferenceToken; code: number }> {
        const handleData = await HandlesController.getHandleFromRepo(req);

        const { reference_token } = new HandleReferenceTokenViewModel(handleData.handle);

        if (!reference_token) {
            return { code: handleData.code };
        }

        return { reference_token, code: handleData.code };
    }

    public async getPersonalizationUTxO(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const { reference_token, code } = await HandlesController.buildHandleReferenceToken(req);

            if (!reference_token) {
                res.status(code).json({});
                return;
            }

            res.status(code).json(reference_token);
        } catch (error) {
            next(error);
        }
    }

    public async getHandleUTxO(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const handleData = await HandlesController.getHandleFromRepo(req);

            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();

            if (!handleData.handle) {
                res.status(404).send({ message: 'Handle not found' });
                return;
            }

            const reference_script = handleData.handle.script?.cbor;
            
            let datum = await handleRepo.getHandleDatumByName(handleData.handle.name);

            if (datum && req.headers?.accept?.startsWith('application/json')) {
                try {
                    datum = await decodeCborToJson({ cborString: datum, schema: {}, defaultKeyType: req.query.default_key_type as DefaultTextFormat });
                } catch {
                    res.status(400).send({ message: 'Unable to decode datum to json' });
                }
            }

            res.status(handleRepo.currentHttpStatus()).json({
                tx_id: handleData.handle.utxo.split('#')[0],
                index: parseInt(handleData.handle.utxo.split('#')[0]),
                lovelace: handleData.handle.lovelace,
                address: handleData.handle.resolved_addresses.ada,
                datum,
                reference_script
            });
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
            const handleData = await HandlesController.getHandleFromRepo(req);

            if (!handleData.handle) {
                res.status(404).send({ message: 'Handle datum not found' });
                return;
            }

            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();

            const handleDatum = await handleRepo.getHandleDatumByName(handleData.handle.name);

            if (!handleDatum) {
                res.status(404).send({ message: 'Handle datum not found' });
                return;
            }

            if (req.headers?.accept?.startsWith('application/json')) {
                try {
                    const decodedDatum = await decodeCborToJson({ cborString: handleDatum, schema: {}, defaultKeyType: req.query.default_key_type as DefaultTextFormat });
                    res.set('Content-Type', 'application/json');
                    res.status(handleRepo.currentHttpStatus()).json(decodedDatum);
                    return;
                } catch {
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
            const handleData = await HandlesController.getHandleFromRepo(req);

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

    public async getSubHandleSettings(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const handleData = await HandlesController.getHandleFromRepo(req);

            if (!handleData?.handle) {
                res.status(404).send({ message: 'Handle not found' });
                return;
            }

            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();
            const settings = await handleRepo.getSubHandleSettings(handleData.handle.name);

            if (!settings || !settings.settings) {
                res.status(404).send({ message: 'SubHandle settings not found' });
                return;
            }

            const { settings: settingsDatumString } = settings;

            if (req.headers?.accept?.startsWith('text/plain')) {
                res.set('Content-Type', 'text/plain; charset=utf-8');
                res.status(handleRepo.currentHttpStatus()).send(settingsDatumString);
                return;
            }

            const decodedSettings = await decodeCborToJson({ cborString: settingsDatumString, schema: subHandleSettingsDatumSchema });

            if (!Array.isArray(decodedSettings)) {
                res.status(400).send({ message: 'Invalid SubHandle settings' });
                return;
            }

            const buildTypeSettings = (typeSettings: any): ISubHandleTypeSettings => {
                return {
                    public_minting_enabled: typeSettings[0],
                    pz_enabled: typeSettings[1],
                    tier_pricing: typeSettings[2],
                    default_styles: typeSettings[3],
                    save_original_address: typeSettings[4]
                };
            };

            const settingsDatum: ISubHandleSettings = {
                nft: buildTypeSettings(decodedSettings[0]),
                virtual: buildTypeSettings(decodedSettings[1]),
                buy_down_price: decodedSettings[2],
                buy_down_paid: decodedSettings[3],
                buy_down_percent: decodedSettings[4],
                agreed_terms: decodedSettings[5],
                migrate_sig_required: decodedSettings[6],
                payment_address: decodedSettings[7]
            };

            res.status(handleData.code).json({
                settings: settingsDatum
            });
        } catch (error) {
            next(error);
        }
    }

    public async getSubHandleSettingsUTxO(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const handleData = await HandlesController.getHandleFromRepo(req);

            if (!handleData?.handle) {
                res.status(404).send({ message: 'Handle not found' });
                return;
            }

            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();
            const settings = await handleRepo.getSubHandleSettings(handleData.handle.name);

            if (!settings?.utxo) {
                res.status(404).send({ message: 'SubHandle settings not found' });
                return;
            }

            res.status(handleData.code).json(settings.utxo);
        } catch (error) {
            next(error);
        }
    }

    public async getSubHandles(req: Request<IGetHandleRequest, {}, {}>, res: Response, next: NextFunction) {
        try {
            const handleData = await HandlesController.getHandleFromRepo(req);

            if (!handleData?.handle) {
                res.status(404).send({ message: 'Handle not found' });
                return;
            }

            const handleRepo: IHandlesRepository = new (req.app.get('registry') as IRegistry).handlesRepo();
            let subHandles = await handleRepo.getSubHandles(handleData.handle.name);

            if (req.query.type) {
                const type = req.query.type === 'virtual' ? HandleType.VIRTUAL_SUBHANDLE : HandleType.NFT_SUBHANDLE;
                subHandles = subHandles.filter((subHandle) => subHandle.handle_type === type);
            }

            res.status(handleData.code).json(subHandles);
        } catch (error) {
            next(error);
        }
    }
}

export default HandlesController;
