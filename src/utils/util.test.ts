import { AssetNameLabel } from '@koralabs/kora-labs-common';
import { checkNameLabel, getDateStringFromSlot, getElapsedTime, getSlotNumberFromDate, isNumeric, writeConsoleLine } from './util';

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

    describe('checkNameLabel', () => {
        it('should return the correct label for asset names', () => {
            const assetName222 = `${AssetNameLabel.LABEL_222}${Buffer.from('burrito').toString('hex')}`;
            expect(checkNameLabel(assetName222)).toEqual({ assetLabel: '222', assetName: 'burrito', isCip67: true });

            const assetName333 = `${AssetNameLabel.LABEL_333}${Buffer.from('burrito').toString('hex')}`;
            expect(checkNameLabel(assetName333)).toEqual({ assetLabel: '333', assetName: 'burrito', isCip67: true });

            const assetName000 = `${AssetNameLabel.LABEL_000}${Buffer.from('burrito').toString('hex')}`;
            expect(checkNameLabel(assetName000)).toEqual({ assetLabel: '000', assetName: 'burrito', isCip67: true });

            const assetName001 = `${AssetNameLabel.LABEL_001}${Buffer.from('burrito').toString('hex')}`;
            expect(checkNameLabel(assetName001)).toEqual({ assetLabel: '001', assetName: 'burrito', isCip67: true });
        });

        it('should return the correct label for 222', () => {
            const assetName = `${Buffer.from('burrito').toString('hex')}`;
            const label = checkNameLabel(assetName);
            expect(label).toEqual({ assetLabel: null, assetName: 'burrito', isCip67: false });
        });
    });
});
