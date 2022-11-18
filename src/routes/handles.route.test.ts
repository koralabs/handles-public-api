import request from 'supertest';
import HandlesRoute from './handles.route';
import App from '../app';
import { HttpException } from '../exceptions/HttpException';

jest.mock('../services/ogmios/ogmios.service');

jest.mock('../ioc', () => ({
    registry: {
        ['handlesRepo']: jest.fn().mockReturnValue({
            getHandleByName: (handleName: string) => {
                if (handleName === 'nope') {
                    throw new HttpException(404, 'Not found');
                }

                return {
                    handle: handleName
                };
            },
            getPersonalizedHandleByName: (handleName: string) => {
                if (handleName === 'nope') {
                    throw new HttpException(404, 'Not found');
                }

                return {
                    handle: handleName
                };
            },
            getAll: () => {
                return [
                    {
                        handle: 'burritos'
                    }
                ];
            },
            getAllHandleNames: () => {
                return ['burritos', 'tacos', 'barbacoa'];
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
        it('should throw error if limit is invalid', async () => {
            const response = await request(app?.getServer()).get('/handles?limit=two');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('Limit must be a number');
        });

        it('should throw error if sort is invalid', async () => {
            const response = await request(app?.getServer()).get('/handles?limit=1&sort=hmm');

            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('Sort must be desc or asc');
        });

        it('should return handles', async () => {
            const response = await request(app?.getServer()).get('/handles?limit=1&sort=asc');

            expect(response.status).toEqual(200);
            expect(response.body.results).toEqual([{ handle: 'burritos' }]);
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

        it('should pass plain text list of Accept is text/plain', async () => {
            const response = await request(app?.getServer())
                .get('/handles')
                .set('api-key', 'valid-key')
                .set('Accept', 'text/plain');
            expect(response.status).toEqual(200);
            expect(response.text).toEqual('burritos\ntacos\nbarbacoa');
        });
    });

    describe('[GET] /handles/:handle', () => {
        it('should throw error if handle does not exist', async () => {
            const response = await request(app?.getServer()).get('/handles/nope');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Not found');
        });

        it('should return valid handle', async () => {
            const response = await request(app?.getServer()).get('/handles/burritos');
            expect(response.status).toEqual(200);
            expect(response.body.handle).toEqual({ handle: 'burritos' });
        });

        it('should return legendary message', async () => {
            const response = await request(app?.getServer()).get('/handles/1');
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
            expect(response.body.message).toEqual('Not found');
        });

        it('should return valid handle', async () => {
            const response = await request(app?.getServer()).get('/handles/burritos/personalized');
            expect(response.status).toEqual(200);
            expect(response.body.handle).toEqual({ handle: 'burritos' });
        });

        it('should return legendary message', async () => {
            const response = await request(app?.getServer()).get('/handles/1/personalized');
            expect(response.status).toEqual(406);
            expect(response.body.message).toEqual('Legendary handles are not available yet.');
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
});
