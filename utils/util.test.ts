import { writeConsoleLine } from './util';

describe('Utils tests', () => {

    describe('writeConsoleLine', () => {
        it('should get correct elapsed time', () => {
            jest.spyOn(process.stdout, 'write');
            const now = Date.now();
            const message = writeConsoleLine(now, 'starting now');
            expect(message).toEqual('0:00 elapsed. starting now');
        });
    });
});
