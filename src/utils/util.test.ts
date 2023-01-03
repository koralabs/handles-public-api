import { handlesFixture } from '../repositories/memory/tests/fixtures/handles';
import { getDateStringFromSlot, getElapsedTime, getSlotNumberFromDate, isNumeric, writeConsoleLine } from './util';

jest.mock('@koralabs/kora-labs-common');

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
            const message = writeConsoleLine(now, 'starting now');
            expect(message).toEqual('0:00 elapsed. starting now');
        });
    });

    describe('getDateStringFromSlot', () => {
        it('should get the correct date string from slot', () => {
            const date = getDateStringFromSlot(78200473);
            expect(date).toEqual(new Date('2022-11-30T00:06:04.000Z'));
        });
    });

    describe('getSlotNumberFromDate', () => {
        it('should get the correct date string from slot', () => {
            const date = getSlotNumberFromDate(new Date('2022-11-30T00:06:04.000Z'));
            expect(date).toEqual(78200473);
        });
    });
});
