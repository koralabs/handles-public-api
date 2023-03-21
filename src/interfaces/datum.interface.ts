export enum DatumConversionType {
    JSON = 'json',
    PLUTUS_DATA_CBOR = 'plutus_data_cbor'
}

export interface IDatumQueryParams {
    from: DatumConversionType;
    to: DatumConversionType;
    body: any;
}
