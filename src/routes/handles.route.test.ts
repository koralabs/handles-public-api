import request from 'supertest';
import App from '../app';
import { registry } from '../ioc';
import * as config from '../config';
import { HttpException } from '../exceptions/HttpException';
import { ERROR_TEXT } from '../services/ogmios/constants';
import * as cbor from '@koralabs/kora-labs-common/utils/cbor';
import * as scripts from '../config/scripts';
import { HandleType, ScriptDetails, ScriptType } from '@koralabs/kora-labs-common';

jest.mock('../services/ogmios/ogmios.service');

jest.mock('../ioc', () => ({
    registry: {
        ['handlesRepo']: jest.fn().mockReturnValue({
            getHandleByName: (handleName: string) => {
                if (['nope', 'l', 'japan', '***'].includes(handleName)) return null;

                if (handleName === 'no-utxo') {
                    return {
                        name: handleName,
                        personalization: {
                            p: 'z'
                        },
                        datum: 'a247'
                    };
                }

                if (handleName === 'no_ref_token') {
                    return {
                        name: handleName,
                        resolved_addresses: {
                            ada: 'addr1'
                        },
                        utxo: 'utxo#0'
                    };
                }

                if (handleName === 'nope@handle') {
                    return null;
                }

                return {
                    name: handleName,
                    utxo: 'utxo#0',
                    resolved_addresses: {
                        ada: 'addr1'
                    },
                    personalization: {
                        p: 'z',
                        reference_token: {
                            address: 'script_addr1'
                        }
                    },
                    reference_token: {
                        tx_id: 'tx_id',
                        index: 0,
                        lovelace: 0,
                        datum: '',
                        address: 'addr1_ref_token',
                        script: { type: 'plutus_v2', cbor: 'a247' }
                    },
                    datum: 'a247',
                    script: {
                        type: 'plutus_v2',
                        cbor: 'a247'
                    }
                };
            },
            getAll: () => {
                return {
                    searchTotal: 1,
                    handles: [
                        {
                            name: 'burritos',
                            utxo: 'utxo#0',
                            personalization: {
                                p: 'z'
                            },
                            datum: 'a247'
                        }
                    ]
                };
            },
            getAllHandleNames: () => {
                return ['burritos', 'tacos', 'barbacoa'];
            },
            getHolderAddressDetails: (key: string) => {
                if (key === 'nope') {
                    throw new HttpException(404, 'Not found');
                }

                return {
                    handles: ['burritos'],
                    default_handle: 'burritos',
                    manually_set: false
                };
            },
            currentHttpStatus: () => {
                return 200;
            },
            getHandleDatumByName: (handleName: string) => {
                if (['nope', 'l', 'japan', '***'].includes(handleName)) return null;

                if (handleName === 'burrito') {
                    return 'd87981a26768616e646c657381a263756d6d647965616862796f6368657964736f6d65a16477656c70a1657468696e67657269676874';
                }

                return `${handleName}_datum`;
            },
            getSubHandleSettings: (handleName: string) => {
                if (handleName === 'no_settings@handle') {
                    return null;
                }

                if (handleName === 'not@array') {
                    return {};
                }

                return {
                    settings: '9f9f01019f9f011a0bebc200ff9f021a05f5e100ff9f031a02faf080ffffa14862675f696d61676540ff9f01019f9f011a01312d00ffffa14862675f696d61676540ff000000581a687474703a2f2f6c6f63616c686f73743a333030372f23746f75005839004988cad9aa1ebd733b165695cfef965fda2ee42dab2d8584c43b039c96f91da5bdb192de2415d3e6d064aec54acee648c2c6879fad1ffda1ff',
                    utxo: {
                        tx_id: 'tx_id',
                        index: 0,
                        lovelace: 0,
                        datum: '',
                        address: 'addr1_ref_token',
                        script: { type: 'plutus_v2', cbor: 'a247' }
                    }
                };
            },
            getSubHandles: (handleName: string) => {
                return [
                    { name: `sh1@${handleName}`, handle_type: HandleType.NFT_SUBHANDLE },
                    { name: `sh2@${handleName}`, handle_type: HandleType.VIRTUAL_SUBHANDLE },
                    { name: `sh3@${handleName}`, handle_type: HandleType.VIRTUAL_SUBHANDLE }
                ];
            }
        }),
        ['apiKeysRepo']: jest.fn().mockReturnValue({
            get: (key: string) => key === 'valid-key'
        })
    }
}));

afterAll(async () => {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));
});

describe('Testing Handles Routes', () => {
    let app: App | null;
    beforeEach(() => {
        app = new App(registry);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('[GET] /handles', () => {
        it('should throw error if records_per_page is invalid', async () => {
            const response = await request(app?.getServer()).get('/handles?records_per_page=two');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual(ERROR_TEXT.HANDLE_LIMIT_INVALID_FORMAT);
        });

        it('should throw error if sort is invalid', async () => {
            const response = await request(app?.getServer()).get('/handles?records_per_page=1&sort=hmm');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual(ERROR_TEXT.HANDLE_SORT_INVALID);
        });

        it('should return handles', async () => {
            const response = await request(app?.getServer()).get('/handles?records_per_page=1&sort=asc');

            expect(response.status).toEqual(200);
            expect(response.body).toEqual([{ name: 'burritos', utxo: 'utxo#0' }]);
        });

        it('should throw error if characters is invalid', async () => {
            const response = await request(app?.getServer()).get('/handles?characters=nope');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('characters must be letters, numbers, special');
        });

        it('should throw error if length is invalid', async () => {
            const response = await request(app?.getServer()).get('/handles?length=nope');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual("Length must be a number or a range of numbers (ex: 1-28) and can't exceed 28");
        });

        it('should throw error if rarity is invalid', async () => {
            const response = await request(app?.getServer()).get('/handles?rarity=nope');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('rarity must be basic, common, rare, ultra_rare, legendary');
        });

        it('should throw error if numeric_modifiers is invalid', async () => {
            const response = await request(app?.getServer()).get('/handles?numeric_modifiers=nope');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('numeric_modifiers must be negative, decimal');
        });

        it('should throw error if page and slot number are used together', async () => {
            const response = await request(app?.getServer()).get('/handles?page=1&slot_number=123');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual("'page' and 'slot_number' can't be used together");
        });

        it('should throw error if handle_type is invalid', async () => {
            const response = await request(app?.getServer()).get('/handles?handle_type=taco');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('handle_type must be virtual_subhandle, nft_subhandle, handle');
        });

        it('should throw error if search query is less than 3 characters', async () => {
            const response = await request(app?.getServer()).get('/handles?search=ab');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('search must be at least 3 characters');
        });

        it('should pass plain text list of Accept is text/plain', async () => {
            const response = await request(app?.getServer()).get('/handles').set('api-key', 'valid-key').set('Accept', 'text/plain; charset=utf-8');
            expect(response.status).toEqual(200);
            expect(response.text).toEqual('burritos\ntacos\nbarbacoa');
        });
    });

    describe('[POST] /handles/list', () => {
        it('should throw error if records_per_page is invalid', async () => {
            const response = await request(app?.getServer()).post('/handles/list?records_per_page=two');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual(ERROR_TEXT.HANDLE_LIMIT_INVALID_FORMAT);
        });

        it('should throw error if sort is invalid', async () => {
            const response = await request(app?.getServer()).post('/handles/list?records_per_page=1&sort=hmm');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual(ERROR_TEXT.HANDLE_SORT_INVALID);
        });

        it('should return handles', async () => {
            const response = await request(app?.getServer()).post('/handles/list?records_per_page=1&sort=asc');

            expect(response.status).toEqual(200);
            expect(response.body).toEqual([{ name: 'burritos', utxo: 'utxo#0' }]);
        });

        it('should fail if handles is not an array', async () => {
            const response = await request(app?.getServer())
                .post('/handles/list')
                .set('Content-Type', 'application/json')
                .send({ handles: ['burritos'] });

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('expected array and received object');
        });

        it('should return handles when handles is set', async () => {
            const response = await request(app?.getServer()).post('/handles/list').set('Content-Type', 'application/json').send(['burritos']);

            expect(response.status).toEqual(200);
            expect(response.body).toEqual([{ name: 'burritos', utxo: 'utxo#0' }]);
        });

        it('should throw error if characters is invalid', async () => {
            const response = await request(app?.getServer()).post('/handles/list?characters=nope');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('characters must be letters, numbers, special');
        });

        it('should throw error if length is invalid', async () => {
            const response = await request(app?.getServer()).post('/handles/list?length=nope');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual("Length must be a number or a range of numbers (ex: 1-28) and can't exceed 28");
        });

        it('should throw error if rarity is invalid', async () => {
            const response = await request(app?.getServer()).post('/handles/list?rarity=nope');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('rarity must be basic, common, rare, ultra_rare, legendary');
        });

        it('should throw error if numeric_modifiers is invalid', async () => {
            const response = await request(app?.getServer()).post('/handles/list?numeric_modifiers=nope');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('numeric_modifiers must be negative, decimal');
        });

        it('should throw error if page and slot number are used together', async () => {
            const response = await request(app?.getServer()).post('/handles/list?page=1&slot_number=123');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual("'page' and 'slot_number' can't be used together");
        });

        it('should throw error if search query is less than 3 characters', async () => {
            const response = await request(app?.getServer()).post('/handles/list?search=ab');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('search must be at least 3 characters');
        });

        it('should pass plain text list of Accept is text/plain', async () => {
            const response = await request(app?.getServer()).post('/handles/list').set('api-key', 'valid-key').set('Accept', 'text/plain; charset=utf-8');
            expect(response.status).toEqual(200);
            expect(response.text).toEqual('burritos\ntacos\nbarbacoa');
        });
    });

    describe('[GET] /handles/:handle', () => {
        it('should throw error if handle does not exist', async () => {
            const response = await request(app?.getServer()).get('/handles/nope');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Handle not found');
        });

        it('should return valid handle', async () => {
            const response = await request(app?.getServer()).get('/handles/burritos');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({ name: 'burritos', resolved_addresses: { ada: 'addr1' }, utxo: 'utxo#0' });
        });

        it('should return legendary handle if available', async () => {
            const response = await request(app?.getServer()).get('/handles/1');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({ name: '1', resolved_addresses: { ada: 'addr1' }, utxo: 'utxo#0' });
        });

        it('should return legendary message when handle does not exist', async () => {
            const response = await request(app?.getServer()).get('/handles/l');
            expect(response.status).toEqual(406);
            expect(response.body.message).toEqual('Legendary handles are not available to mint.');
        });

        it('should return invalid message', async () => {
            const response = await request(app?.getServer()).get('/handles/***');
            expect(response.status).toEqual(406);
            expect(response.body.message).toEqual('Invalid handle. Only a-z, 0-9, dash (-), underscore (_), and period (.) are allowed.');
        });

        it('should return 404 for unminted subhandle', async () => {
            const response = await request(app?.getServer()).get('/handles/nope@handle');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Handle not found');
        });

        it('should return not allowed message', async () => {
            const response = await request(app?.getServer()).get('/handles/japan');
            expect(response.status).toEqual(451);
            expect(response.body.message).toEqual("Protected word match on 'jap,an'");
        });

        it('should throw error if handle does not have a utxo', async () => {
            const response = await request(app?.getServer()).get('/handles/no-utxo');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Handle not found');
        });
    });

    describe('[GET] /handles/:handle/personalized', () => {
        it('should throw error if handle does not exist', async () => {
            const response = await request(app?.getServer()).get('/handles/nope/personalized');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Handle not found');
        });

        it('should return valid handle', async () => {
            const scriptDetails: ScriptDetails = {
                handle: 'pz_script_01',
                handleHex: 'hex',
                validatorHash: 'abc',
                type: ScriptType.PZ_CONTRACT
            };
            jest.spyOn(scripts, 'getScript').mockReturnValue(scriptDetails);
            const response = await request(app?.getServer()).get('/handles/burritos/personalized');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                p: 'z',
                reference_token: {
                    address: 'script_addr1'
                }
            });
        });

        it('should return legendary message', async () => {
            const response = await request(app?.getServer()).get('/handles/l');
            expect(response.status).toEqual(406);
            expect(response.body.message).toEqual('Legendary handles are not available to mint.');
        });

        it('should return legendary handle if available', async () => {
            const response = await request(app?.getServer()).get('/handles/j/personalized');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                p: 'z',
                reference_token: {
                    address: 'script_addr1'
                }
            });
        });

        it('should return invalid message', async () => {
            const response = await request(app?.getServer()).get('/handles/***');
            expect(response.status).toEqual(406);
            expect(response.body.message).toEqual('Invalid handle. Only a-z, 0-9, dash (-), underscore (_), and period (.) are allowed.');
        });

        it('should return not allowed message', async () => {
            const response = await request(app?.getServer()).get('/handles/japan');
            expect(response.status).toEqual(451);
            expect(response.body.message).toEqual("Protected word match on 'jap,an'");
        });
    });

    describe('[GET] /holders/:address', () => {
        it('should throw error if address does not exist', async () => {
            const response = await request(app?.getServer()).get('/holders/nope');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Not found');
        });

        it('should return valid handle', async () => {
            const response = await request(app?.getServer()).get('/holders/address');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                handles: ['burritos'],
                default_handle: 'burritos',
                manually_set: false
            });
        });
    });

    describe('[GET] /handles/:handle/datum', () => {
        it('should return error if ENABLE_DATUM_ENDPOINT is false', async () => {
            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(false);
            const response = await request(app?.getServer()).get('/handles/taco/datum');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('Datum endpoint is disabled');
        });

        it('should throw error if address does not exist', async () => {
            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);
            const response = await request(app?.getServer()).get('/handles/nope/datum');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Handle datum not found');
        });

        it('should decode json if accept is application/json', async () => {
            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);
            const response = await request(app?.getServer()).get('/handles/burrito/datum').set('Accept', 'application/json');
            expect(response.status).toEqual(200);
            expect(response.body.constructor_0[0]).toEqual({
                handles: [{ umm: 'yeah', yo: 'hey' }],
                some: { welp: { thing: 'right' } }
            });
        });

        it('should return valid handle as text', async () => {
            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);
            const response = await request(app?.getServer()).get('/handles/taco/datum');
            expect(response.status).toEqual(200);
            expect(response.text).toEqual('taco_datum');
        });

        it('should error trying to decode json and throw 400', async () => {
            jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);
            jest.spyOn(cbor, 'decodeCborToJson').mockImplementation(() => {
                throw new Error('test');
            });
            const response = await request(app?.getServer()).get('/handles/taco/datum').set('Accept', 'application/json');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('Unable to decode datum to json');
        });
    });

    describe('[GET] /handles/:handle/script', () => {
        it('should return valid script for handle', async () => {
            const response = await request(app?.getServer()).get('/handles/skirt_steak_taco/script');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                type: 'plutus_v2',
                cbor: 'a247'
            });
        });

        it('should return script not found', async () => {
            const response = await request(app?.getServer()).get('/handles/no-utxo/script');
            expect(response.status).toEqual(404);
            expect(response.body).toEqual({ message: 'Script not found' });
        });
    });

    describe('[GET] /handles/:handle/reference_token', () => {
        it('should get reference token datum for a handle', async () => {
            const scriptDetails: ScriptDetails = {
                handle: 'pz_script_01',
                handleHex: 'hex',
                validatorHash: 'abc',
                type: ScriptType.PZ_CONTRACT
            };
            jest.spyOn(scripts, 'getScript').mockReturnValue(scriptDetails);
            const response = await request(app?.getServer()).get('/handles/burritos/reference_token');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({ address: 'addr1_ref_token', datum: '', index: 0, lovelace: 0, script: scriptDetails, tx_id: 'tx_id' });
        });

        it('should return empty object when reference token cannot be found', async () => {
            const response = await request(app?.getServer()).get('/handles/no_ref_token/reference_token');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({});
        });
    });

    describe('[GET] /handles/:handle/utxo', () => {
        it('should get reference token datum for a handle', async () => {
            const scriptDetails: ScriptDetails = {
                handle: 'pz_script_01',
                handleHex: 'hex',
                validatorHash: 'abc',
                type: ScriptType.PZ_CONTRACT
            };
            jest.spyOn(scripts, 'getScript').mockReturnValue(scriptDetails);
            const response = await request(app?.getServer()).get('/handles/burritos/utxo');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({ address: 'addr1_ref_token', datum: '', index: 0, lovelace: 0, script: scriptDetails, tx_id: 'tx_id' });
        });

        it('should return empty object when reference token cannot be found', async () => {
            const response = await request(app?.getServer()).get('/handles/no_ref_token/reference_token');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({});
        });
    });

    describe('[GET] /handles/:handle/subhandle_settings', () => {
        it('should return 404 for unminted subhandle', async () => {
            const response = await request(app?.getServer()).get('/handles/nope@handle/subhandle_settings');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Handle not found');
        });

        it('should return No sub handle settings found', async () => {
            const response = await request(app?.getServer()).get('/handles/no_settings@handle/subhandle_settings');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('SubHandle settings not found');
        });

        it('should return invalid settings', async () => {
            const response = await request(app?.getServer()).get('/handles/not@array/subhandle_settings');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('SubHandle settings not found');
        });

        it('should return settings cbor', async () => {
            const response = await request(app?.getServer()).get('/handles/sub@handle/subhandle_settings').set('Accept', 'text/plain; charset=utf-8');
            expect(response.status).toEqual(200);
            expect(response.text).toEqual('9f9f01019f9f011a0bebc200ff9f021a05f5e100ff9f031a02faf080ffffa14862675f696d61676540ff9f01019f9f011a01312d00ffffa14862675f696d61676540ff000000581a687474703a2f2f6c6f63616c686f73743a333030372f23746f75005839004988cad9aa1ebd733b165695cfef965fda2ee42dab2d8584c43b039c96f91da5bdb192de2415d3e6d064aec54acee648c2c6879fad1ffda1ff');
        });

        it('should return settings json', async () => {
            const response = await request(app?.getServer()).get('/handles/sub@handle2/subhandle_settings');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
                settings: {
                    agreed_terms: 'http://localhost:3007/#tou',
                    buy_down_paid: 0,
                    buy_down_price: 0,
                    buy_down_percent: 0,
                    migrate_sig_required: false,
                    nft: {
                        public_minting_enabled: true,
                        pz_enabled: true,
                        default_styles: { bg_image: '' },
                        tier_pricing: [
                            [1, 200000000],
                            [2, 100000000],
                            [3, 50000000]
                        ]
                    },
                    payment_address: '0x004988cad9aa1ebd733b165695cfef965fda2ee42dab2d8584c43b039c96f91da5bdb192de2415d3e6d064aec54acee648c2c6879fad1ffda1',
                    virtual: {
                        default_styles: { bg_image: '' },
                        public_minting_enabled: true,
                        pz_enabled: true,
                        tier_pricing: [[1, 20000000]]
                    }
                }
            });
        });
    });

    describe('[GET] /handles/:handle/subhandle_settings/utxo', () => {
        it('should return 404 for unminted subhandle', async () => {
            const response = await request(app?.getServer()).get('/handles/nope@handle/subhandle_settings/utxo');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Handle not found');
        });

        it('should return No sub handle settings found', async () => {
            const response = await request(app?.getServer()).get('/handles/no_settings@handle/subhandle_settings/utxo');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('SubHandle settings not found');
        });

        it('should return invalid settings', async () => {
            const response = await request(app?.getServer()).get('/handles/not@array/subhandle_settings/utxo');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('SubHandle settings not found');
        });

        it('should return settings utxo json', async () => {
            const response = await request(app?.getServer()).get('/handles/sub@handle2/subhandle_settings/utxo');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({ address: 'addr1_ref_token', datum: '', index: 0, lovelace: 0, script: { cbor: 'a247', type: 'plutus_v2' }, tx_id: 'tx_id' });
        });
    });

    describe('[GET] /handles/:handle/subhandles', () => {
        it('should return 404 for handle not found subhandle', async () => {
            const response = await request(app?.getServer()).get('/handles/nope@handle/subhandles');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Handle not found');
        });

        it('should return all subhandles', async () => {
            const handleName = 'taco';
            const response = await request(app?.getServer()).get(`/handles/${handleName}/subhandles`);
            expect(response.status).toEqual(200);
            expect(response.body).toEqual([
                { name: `sh1@${handleName}`, handle_type: HandleType.NFT_SUBHANDLE },
                { name: `sh2@${handleName}`, handle_type: HandleType.VIRTUAL_SUBHANDLE },
                { name: `sh3@${handleName}`, handle_type: HandleType.VIRTUAL_SUBHANDLE }
            ]);
        });

        it('should return all virtual subHandles', async () => {
            const handleName = 'burritos';
            const response = await request(app?.getServer()).get(`/handles/${handleName}/subhandles?type=virtual`);
            expect(response.status).toEqual(200);
            expect(response.body).toEqual([
                { name: `sh2@${handleName}`, handle_type: HandleType.VIRTUAL_SUBHANDLE },
                { name: `sh3@${handleName}`, handle_type: HandleType.VIRTUAL_SUBHANDLE }
            ]);
        });

        it('should return all nft subHandles', async () => {
            const handleName = 'burritos';
            const response = await request(app?.getServer()).get(`/handles/${handleName}/subhandles?type=nft`);
            expect(response.status).toEqual(200);
            expect(response.body).toEqual([{ name: `sh1@${handleName}`, handle_type: HandleType.NFT_SUBHANDLE }]);
        });
    });
});
