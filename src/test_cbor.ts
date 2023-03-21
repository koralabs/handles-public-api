// @ts-ignore
import { Tagged, encode, Decoder } from "borc"

//const json = {"firstKey": "firstValue", "secondKey": {"firstList": ["1","2"], "secondList": [{"thirdKey":"thirdValue"},{"fourthKey":"fourthValue"}]}}
const json = {
    constructor_0: [
        {
            name: "xar12345",
            image: "ipfs://image_cid",
            mediaType: "image/png",
            og: false,
            rarity: "basic",
            length: 8,
            character_type: "characters,numbers",
            numeric_modifier: "",
            og_number: 0,
            version: 1
        }, 
        1, 
        {
            constructor_0: [
                {
                custom_image: "ipfs://cid",
                bg_image: "ipfs://cid",
                pfp_image: "ipfs://cid",
                settings: "ipfs://cid",
                socials: "ipfs://cid",
                vendor: "ipfs://cid",
                default: true,
                holder: "stake1..."
            }]
        }
    ]
};

class JsonToDatumObject {
    json: any;
    constructor(json: any) {
        this.json = json;
        if (Array.isArray(this.json)) {
            for (let i=0; i<this.json.length; i++){
                this.json[i] = new JsonToDatumObject(this.json[i]);
            }
        }
        else if (typeof(this.json) === 'object') {
            if (this.json !== null ) {
                Object.keys(this.json).map(key => {
                    this.json[key] = new JsonToDatumObject(this.json[key]);
                })
            };
        } 
    }

    encodeCBOR = (encoder: any) => {
        if (Array.isArray(this.json)) {
            return encoder.pushAny(this.json);
        } 
        else if (typeof(this.json) === 'object') {
            if (this.json !== null ) {
                const fieldsMap = new Map();
                let tag = null;
                for (let key of Object.keys(this.json)) {
                    let split_key = parseInt(key.split('_').at(1) ?? '');
                    if (key.startsWith('constructor_') && !isNaN(split_key) && [0,1,2,3].includes(split_key as number)){
                        tag = 121+split_key;
                        return encoder.pushAny(new Tagged(tag, this.json[key]));
                    }
                    fieldsMap.set(Buffer.from(key), this.json[key])
                };
                return encoder.pushAny(fieldsMap);
            } else {
                return encoder.pushAny(Buffer.from('null'));
            }
        } 
        else if (Number.isInteger(this.json)) {
            return encoder.pushAny(this.json);
        }
        else if (typeof(this.json) === 'string') {
            return encoder.pushAny(Buffer.from(this.json));
        }
        else {
            // anything else: convert to simple type - String.
            // e.g. undefined, true, false, NaN, Infinity.
            // Some of these can't be represented in JSON anyway.
            // Floating point numbers: note there can be loss of precision when
            // representing floats as decimal numbers
            return encoder.pushAny(Buffer.from('' + this.json));
        }
    }
}

const encoded = encode(new JsonToDatumObject(json)).toString('hex').toString('hex');
console.log('ENCODED:', encoded);

const decodeObject = (val: any, constr:number|null=null): any => {
    const isMap = val instanceof Map;
    if (isMap){
        const obj:any = {};
        for (let key of val.keys()) {
            let value = val.get(key);
            if (Buffer.isBuffer(value))
                value = Buffer.from(value).toString();
    
            if (Buffer.isBuffer(key))
                key = Buffer.from(key).toString();
    
            obj[key] = decodeObject(value);
        }
        if (constr != null) {
            return { [`constructor_${constr}`]: obj };
        }
        else {
            return obj;
        }
    }
    else if (Array.isArray(val)) {
        const arr = [];
        for (let i = 0; i<val.length; i++) {
            arr.push(decodeObject(val[i]));
            if (val[i] instanceof Map){
            }
        }
        if (constr != null) {
            return { [`constructor_${constr}`]: arr };
        }
        else {
            return arr;
        }
    }
    else {
        return val;
    }

}

const d = new Decoder({
    tags: {
        121: (val: any) => {return decodeObject(val, 0)},
        122: (val: any) => {return decodeObject(val, 1)},
        123: (val: any) => {return decodeObject(val, 2)},
        124: (val: any) => {return decodeObject(val, 3)},
    },
  })

const decoded = decodeObject(d.decodeAll(Buffer.from(encoded, 'hex'), 'hex')[0]);

console.log('DECODED', decoded)
console.log('STRINGIFIED', JSON.stringify(decoded));

 // The five ways to represent metadata/datum:
 // Json (cardano-cli can take this with --tx-out-datum-json-value)
 // TxMetadataJson ("Detailed Schema")
 // TxMetadataCbor
 // PlutusDataJson ("Schema Json")
 // PlutusDataCbor