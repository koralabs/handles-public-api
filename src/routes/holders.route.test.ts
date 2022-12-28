import request from 'supertest';
import App from '../app';
import { HttpException } from '../exceptions/HttpException';
import { ERROR_TEXT } from '../services/ogmios/constants';

jest.mock('../services/ogmios/ogmios.service');

jest.mock('../ioc', () => ({
    registry: {
        ['handlesRepo']: jest.fn().mockReturnValue({
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

describe('Testing Holders Routes', () => {
    let app: App | null;
    beforeEach(() => {
        app = new App();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('[GET] /holders', () => {
        it('should return coming soon', async () => {
            const response = await request(app?.getServer()).get('/holders');
            expect(response.status).toEqual(200);
            expect(response.body.message).toEqual('Coming Soon');
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
});
