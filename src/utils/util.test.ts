import { Logger } from './logger';
import { getElapsedTime, isNumeric, writeConsoleLine } from './util';

jest.mock('./logger');

describe('Utils tests', () => {
    describe('isNumeric', () => {
        it('should be numeric', () => {
            const isNumber = isNumeric('5');
            expect(isNumber).toBeTruthy();
        });
    });

    describe('getElapsedTime', () => {
        it('should get correct elapsed time', () => {
            const time = getElapsedTime(121000);
            expect(time).toEqual('2:01');
        });
    });

    describe('writeConsoleLine', () => {
        it('should get correct elapsed time', () => {
            const loggerSpy = jest.spyOn(process.stdout, 'write');
            const now = Date.now();
            writeConsoleLine(now, 'starting now');
            expect(loggerSpy).toHaveBeenNthCalledWith(3, '0:00 elapsed. starting now');
        });
    });
});
