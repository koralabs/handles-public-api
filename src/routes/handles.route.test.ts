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
            getAll: () => {
                return [
                    {
                        handle: 'burritos'
                    }
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
    describe('[GET] /handles', () => {
        // it('should throw error if api-key header is not available', async () => {
        //     const handlesRoute = new HandlesRoute();
        //     const app = new App([handlesRoute]);

        //     const response = await request(app.getServer()).get('/handles');
        //     expect(response.status).toEqual(404);
        //     expect(response.body.message).toEqual('Missing api-key');
        // });

        // it('should throw error if api-key is invalid', async () => {
        //     const handlesRoute = new HandlesRoute();
        //     const app = new App([handlesRoute]);

        //     const response = await request(app.getServer()).get('/handles').set('api-key', 'fake-key-1');
        //     expect(response.status).toEqual(401);
        //     expect(response.body.message).toEqual('Wrong authentication token');
        // });

        it('should throw error if limit is invalid', async () => {
            const handlesRoute = new HandlesRoute();
            const app = new App([handlesRoute]);

            const response = await request(app.getServer()).get('/handles?limit=two').set('api-key', 'valid-key');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('Limit must be a number');
        });

        it('should throw error if sort is invalid', async () => {
            const handlesRoute = new HandlesRoute();
            const app = new App([handlesRoute]);

            const response = await request(app.getServer())
                .get('/handles?limit=1&sort=hmm')
                .set('api-key', 'valid-key');
            expect(response.status).toEqual(400);
            expect(response.body.message).toEqual('Sort must be desc or asc');
        });

        it('should return handles', async () => {
            const handlesRoute = new HandlesRoute();
            const app = new App([handlesRoute]);

            const response = await request(app.getServer())
                .get('/handles?limit=1&sort=asc')
                .set('api-key', 'valid-key');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({ data: [{ handle: 'burritos' }] });
        });
    });

    describe('[GET] /handles/:handle', () => {
        // it('should throw error if api-key header is not available', async () => {
        //     const handlesRoute = new HandlesRoute();
        //     const app = new App([handlesRoute]);

        //     const response = await request(app.getServer()).get('/handles/burritos');
        //     expect(response.status).toEqual(404);
        //     expect(response.body.message).toEqual('Missing api-key');
        // });

        // it('should throw error if api-key is invalid', async () => {
        //     const handlesRoute = new HandlesRoute();
        //     const app = new App([handlesRoute]);

        //     const response = await request(app.getServer()).get('/handles/burritos').set('api-key', 'fake-key-1');
        //     expect(response.status).toEqual(401);
        //     expect(response.body.message).toEqual('Wrong authentication token');
        // });

        it('should throw error if handle does not exist', async () => {
            const handlesRoute = new HandlesRoute();
            const app = new App([handlesRoute]);

            const response = await request(app.getServer()).get('/handles/nope').set('api-key', 'valid-key');
            expect(response.status).toEqual(404);
            expect(response.body.message).toEqual('Not found');
        });

        it('should return valid handle', async () => {
            const handlesRoute = new HandlesRoute();
            const app = new App([handlesRoute]);

            const response = await request(app.getServer()).get('/handles/burritos').set('api-key', 'valid-key');
            expect(response.status).toEqual(200);
            expect(response.body).toEqual({ data: { handle: 'burritos' } });
        });
    });
});
