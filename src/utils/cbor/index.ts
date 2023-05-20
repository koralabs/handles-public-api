import * as cbor from 'cbor';

// The five ways to represent metadata/datum:
// Json (cardano-cli can take this with --tx-out-datum-json-value)
// TxMetadataJson ("Detailed Schema")
// TxMetadataCbor
// PlutusDataJson ("Schema Json")
// PlutusDataCbor

// Constructor vs Not
// Sort of similar to:
// const instance = new CustomObject(<json>)
// vs
// const obj = JSON.parse(<json>)

class JsonToDatumObject {
    json: any;
    constructor(json: any) {
        this.json = json;
        if (Array.isArray(this.json)) {
            for (let i = 0; i < this.json.length; i++) {
                this.json[i] = new JsonToDatumObject(this.json[i]);
            }
        } else if (typeof this.json === 'object') {
            if (this.json !== null) {
                Object.keys(this.json).map((key) => {
                    this.json[key] = new JsonToDatumObject(this.json[key]);
                });
            }
        }
    }

    encodeCBOR = (encoder: any) => {
        if (Array.isArray(this.json)) {
            return encoder.pushAny(this.json);
        } else if (typeof this.json === 'object') {
            if (this.json !== null) {
                const fieldsMap = new Map();
                let tag = null;
                for (let key of Object.keys(this.json)) {
                    let split_key = parseInt(key.split('_').at(1) ?? '');
                    if (
                        key.startsWith('constructor_') &&
                        !isNaN(split_key) &&
                        [0, 1, 2, 3].includes(split_key as number)
                    ) {
                        tag = 121 + split_key;
                        return encoder.pushAny(new cbor.Tagged(tag, this.json[key]));
                    }

                    const bufferedKey = key.startsWith('0x') ? Buffer.from(key.substring(2), 'hex') : key;

                    fieldsMap.set(bufferedKey, this.json[key]);
                }
                return encoder.pushAny(fieldsMap);
            } else {
                return encoder.pushAny(Buffer.from('null'));
            }
        } else if (Number.isInteger(this.json)) {
            return encoder.pushAny(this.json);
        } else if (typeof this.json === 'string') {
            // check for hex and if so, decode it
            const bufferedKey = this.json.startsWith('0x') ? Buffer.from(this.json.substring(2), 'hex') : this.json;

            return bufferedKey.length > 64
                ? cbor.Encoder.encodeIndefinite(encoder, bufferedKey, { chunkSize: 64 })
                : encoder.pushAny(bufferedKey);
        } else if (typeof this.json === 'boolean') {
            return encoder.pushAny(this.json);
        } else {
            // anything else: convert to simple type - String.
            // e.g. undefined, true, false, NaN, Infinity.
            // Some of these can't be represented in JSON anyway.
            // Floating point numbers: note there can be loss of precision when
            // representing floats as decimal numbers
            return encoder.pushAny(Buffer.from('' + this.json));
        }
    };
}

export const encodeJsonToDatum = async (json: any) => {
    const obj = new JsonToDatumObject(json);
    const result = await cbor.encodeAsync(obj, { chunkSize: 64 });
    return result.toString('hex');
};

const decodeObject = (val: any, constr: number | null = null): any => {
    const isMap = val instanceof Map;
    if (isMap) {
        const obj: any = {};
        for (let key of val.keys()) {
            let value = val.get(key);
            obj[decodeObject(key)] = decodeObject(value);
        }
        if (constr != null) {
            return { [`constructor_${constr}`]: obj };
        } else {
            return obj;
        }
    } else if (typeof val === 'object' && val.constructor === Object) {
        const obj: any = {};
        for (let key of Object.keys(val)) {
            let value = val[key];
            obj[decodeObject(key)] = decodeObject(value);
        }
        if (constr != null) {
            return { [`constructor_${constr}`]: obj };
        } else {
            return obj;
        }
    } else if (Array.isArray(val)) {
        const arr = [];
        for (let i = 0; i < val.length; i++) {
            arr.push(decodeObject(val[i]));
            if (val[i] instanceof Map) {
            }
        }
        if (constr != null) {
            return { [`constructor_${constr}`]: arr };
        } else {
            return arr;
        }
    } else if (Buffer.isBuffer(val)) {
        const hex = Buffer.from(val).toString('hex');
        return `0x${hex}`;
    } else {
        return val;
    }
};

export const decodeCborToJson = async (cborString: string) => {
    let ranDecode = false;
    const decoded = await cbor.decodeAll(Buffer.from(cborString, 'hex'), {
        tags: {
            121: (val: any) => {
                ranDecode = true;
                return decodeObject(val, 0);
            },
            122: (val: any) => {
                ranDecode = true;
                return decodeObject(val, 1);
            },
            123: (val: any) => {
                ranDecode = true;
                return decodeObject(val, 2);
            },
            124: (val: any) => {
                ranDecode = true;
                return decodeObject(val, 3);
            }
        }
    });

    const [data] = decoded;
    if (!ranDecode) {
        return decodeObject(data);
    }

    return data;
};
