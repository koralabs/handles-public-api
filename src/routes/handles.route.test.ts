import request from 'supertest';
import App from '../app';
import * as config from '../config';
import { HttpException } from '../exceptions/HttpException';
import { ERROR_TEXT } from '../services/ogmios/constants';
import * as serialization from '../utils/serialization';

jest.mock('../services/ogmios/ogmios.service');

jest.mock('../ioc', () => ({
    registry: {
        ['handlesRepo']: jest.fn().mockReturnValue({
            getHandleByName: (handleName: string) => {
                if (['nope', 'l', 'japan', '***'].includes(handleName)) return null;

                return {
                    name: handleName
                };
            },
            getPersonalizedHandleByName: (handleName: string) => {
                if (['nope', 'l', 'japan', '***'].includes(handleName)) return null;

                return {
                    name: handleName
                };
            },
            getAll: () => {
                return [
                    {
                        name: 'burritos'
                    }
                ];
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
            getIsCaughtUp: () => {
                return true;
            },
            getHandleDatumByName: (handleName: string) => {
                if (['nope', 'l', 'japan', '***'].includes(handleName)) return null;

                if (handleName === 'burrito') {
                    return 'a24768616e646c65739fa243756d6d447965616842796f43686579ff44736f6d65a14477656c70a1457468696e67457269676874';
                }

                return `${handleName}_datum`;
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
        app = new App();
    });

    afterEach(() => {
        jest.clearAllMocks();
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
            expect(response.body).toEqual([{ name: 'burritos' }]);
        });

        it('should throw error if characters is invalid', async () => {
            const response = await request(app?.getServer()).get('/handles?characters=nope');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('characters must be letters, numbers, special');
        });

        it('should throw error if length is invalid', async () => {
            const response = await request(app?.getServer()).get('/handles?length=nope');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('Length must be a number');
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

        it('should throw error if search query is less than 3 characters', async () => {
            const response = await request(app?.getServer()).get('/handles?search=ab');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('search must be at least 3 characters');
        });

        it('should pass plain text list of Accept is text/plain', async () => {
            const response = await request(app?.getServer())
                .get('/handles')
                .set('api-key', 'valid-key')
                .set('Accept', 'text/plain; charset=utf-8');
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
            expect(response.body.name).toEqual('burritos');
        });

        it('should return legendary handle if available', async () => {
            const response = await request(app?.getServer()).get('/handles/1');
            expect(response.status).toEqual(200);
            expect(response.body.name).toEqual('1');
        });

        it('should return legendary message when handle does not exist', async () => {
            const response = await request(app?.getServer()).get('/handles/l');
            expect(response.status).toEqual(406);
            expect(response.body.message).toEqual('Legendary handles are not available yet.');
        });

        it('should return invalid message', async () => {
            const response = await request(app?.getServer()).get('/handles/***');
            expect(response.status).toEqual(406);
            expect(response.body.message).toEqual(
                'Invalid handle. Only a-z, 0-9, dash (-), underscore (_), and period (.) are allowed.'
            );
        });

        it('should return not allowed message', async () => {
            const response = await request(app?.getServer()).get('/handles/japan');
            expect(response.status).toEqual(451);
            expect(response.body.message).toEqual("Protected word match on 'jap,an'");
        });
    });

    describe('[GET] /handles/:handle/personalized', () => {
        it('should throw error if handle does not exist', async () => {
            const response = await request(app?.getServer()).get('/handles/nope/personalized');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Handle not found');
        });

        it('should return valid handle', async () => {
            const response = await request(app?.getServer()).get('/handles/burritos/personalized');
            expect(response.status).toEqual(200);
            expect(response.body.name).toEqual('burritos');
        });

        it('should return legendary message', async () => {
            const response = await request(app?.getServer()).get('/handles/l/personalized');
            expect(response.status).toEqual(406);
            expect(response.body.message).toEqual('Legendary handles are not available yet.');
        });

        it('should return legendary handle if available', async () => {
            const response = await request(app?.getServer()).get('/handles/j/personalized');
            expect(response.status).toEqual(200);
            expect(response.body.name).toEqual('j');
        });

        it('should return invalid message', async () => {
            const response = await request(app?.getServer()).get('/handles/***/personalized');
            expect(response.status).toEqual(406);
            expect(response.body.message).toEqual(
                'Invalid handle. Only a-z, 0-9, dash (-), underscore (_), and period (.) are allowed.'
            );
        });

        it('should return not allowed message', async () => {
            const response = await request(app?.getServer()).get('/handles/japan/personalized');
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
            const response = await request(app?.getServer())
                .get('/handles/burrito/datum')
                .set('Accept', 'application/json');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({
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
            jest.spyOn(serialization, 'decodeDatum').mockImplementation(() => {
                throw new Error('test');
            });
            const response = await request(app?.getServer())
                .get('/handles/taco/datum')
                .set('Accept', 'application/json');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('Unable to decode datum to json');
        });
    });
});
