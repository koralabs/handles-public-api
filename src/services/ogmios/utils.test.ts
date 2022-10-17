import { buildNumericModifiers } from './utils';

describe('Utils Tests', () => {
    describe('buildNumericModifiers tests', () => {
        it('should be negative', () => {
            const result = buildNumericModifiers('-1');
            expect(result).toEqual('negative');
        });

        it('should be decimal', () => {
            const result = buildNumericModifiers('0.1');
            expect(result).toEqual('decimal');
        });

        it('should be negative decimal', () => {
            const result = buildNumericModifiers('-0.1');
            expect(result).toEqual('negative,decimal');
        });

        it('should be blank for characters', () => {
            const blankSets = ['1a', '1', '-.-', '--1', '1.2.'];

            blankSets.forEach((set) => {
                const result = buildNumericModifiers(set);
                expect(`${set} should be "${result}"`).toEqual(`${set} should be ""`);
            });
        });
    });
});
