import { Tagged, encode, Decoder } from 'borc';

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
                        return encoder.pushAny(new Tagged(tag, this.json[key]));
                    }

                    let bufferedKey = Buffer.from(key);
                    if (key.startsWith('0x')) {
                        bufferedKey = Buffer.from(key.substring(2), 'hex');
                    }

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
            if (this.json.startsWith('0x')) {
                return encoder.pushAny(Buffer.from(this.json.substring(2), 'hex'));
            }
            return encoder.pushAny(Buffer.from(this.json));
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

export const encodeJsonToDatum = (json: any) => {
    const obj = new JsonToDatumObject(json);
    return encode(obj).toString('hex').toString('hex');
};

const decodeObject = (val: any, constr: number | null = null): any => {
    const isMap = val instanceof Map;
    if (isMap) {
        const obj: any = {};
        for (let key of val.keys()) {
            let value = val.get(key);
            if (Buffer.isBuffer(value)) value = Buffer.from(value).toString();

            if (Buffer.isBuffer(key)) key = Buffer.from(key).toString();

            obj[key] = decodeObject(value);
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
        const bufferString = Buffer.from(val).toString();
        return bufferString.match(/^[0-9a-fA-F]+$/) ? `0x${bufferString}` : bufferString;
    } else {
        return val;
    }
};

export const decodeJsonDatumToJson = (cbor: string) => {
    const d = new Decoder({
        tags: {
            121: (val: any) => {
                return decodeObject(val, 0);
            },
            122: (val: any) => {
                return decodeObject(val, 1);
            },
            123: (val: any) => {
                return decodeObject(val, 2);
            },
            124: (val: any) => {
                return decodeObject(val, 3);
            }
        }
    });

    return decodeObject(d.decodeAll(Buffer.from(cbor, 'hex'), 'hex')[0]);
};
