import { NextFunction, Request, Response } from 'express';
import { RequestWithRegistry } from '../interfaces/auth.interface';
import { IDatumQueryParams } from '../interfaces/datum.interface';
import IHandlesRepository from '../repositories/handles.repository';
import { encodeJsonToDatum, decodeJsonDatumToJson } from '../utils/cbor';

class DatumController {
    public index = (req: Request, res: Response, next: NextFunction): void => {
        try {
            if (req.query.from === 'json' && req.query.to === 'plutus_data_cbor') {
                const encoded = encodeJsonToDatum(req.body);
                res.status(200).contentType('text/plain; charset=utf-8').send(encoded);
                return;
            }

            if (req.query.from === 'plutus_data_cbor' && req.query.to === 'json') {
                const decoded = decodeJsonDatumToJson(req.body);
                res.status(200).json(decoded);
                return;
            }

            res.sendStatus(200);
        } catch (error) {
            next(error);
        }
    };
}

export default DatumController;
