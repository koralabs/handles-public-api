import { NextFunction, Request, Response } from 'express';
import { encodeJsonToDatum, decodeCborToJson, KeyType } from '../utils/cbor';

class DatumController {
    public index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (req.query.from === 'json' && req.query.to === 'plutus_data_cbor') {
                const encoded = await encodeJsonToDatum(req.body);
                res.status(200).contentType('text/plain; charset=utf-8').send(encoded);
                return;
            }

            if (req.query.from === 'plutus_data_cbor' && req.query.to === 'json') {
                if (req.headers?.['content-type']?.startsWith('text/plain')) {
                    const decoded = await decodeCborToJson(req.body, {}, req.query.default_key_type as KeyType);
                    res.status(200).json(decoded);
                    return;
                }

                const { cbor, schema = {} } = req.body;
                if (!cbor) {
                    res.status(400).send({ message: 'cbor required' });
                    return;
                }

                const decoded = await decodeCborToJson(cbor, schema, req.query.default_key_type as KeyType);
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
