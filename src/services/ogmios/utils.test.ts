import { buildNumericModifiers, getRarity, stringifyBlock } from './utils';

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

    describe('getRarity', () => {
        it('should return basic rarity', () => {
            const rarity = getRarity('will_be_common');
            expect(rarity).toEqual('basic');
        });

        it('should return common rarity', () => {
            const rarity = getRarity('common');
            expect(rarity).toEqual('common');
        });

        it('should return rare rarity', () => {
            const rarity = getRarity('_._');
            expect(rarity).toEqual('rare');
        });

        it('should return ultra rare rarity', () => {
            const rarity = getRarity('__');
            expect(rarity).toEqual('ultra_rare');
        });

        it('should return legendary rarity', () => {
            const rarity = getRarity('.');
            expect(rarity).toEqual('legendary');
        });
    });

    describe('stringifyBlock', () => {
        it('should stringify with a big int', () => {
            const burritos = stringifyBlock({ burritos: BigInt(1) });
            expect(burritos).toEqual('{"burritos":"1"}');
        });
    });
});
