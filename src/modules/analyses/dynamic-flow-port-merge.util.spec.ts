import { mergeIncomingGeneric, mergeMapperKeyedInputs } from './dynamic-flow-port-merge.util';

describe('dynamic-flow-port-merge.util', () => {
    it('mergeMapperKeyedInputs stores one value per port (no root flattening)', () => {
        const r = mergeMapperKeyedInputs({
            in: [{ logoUrl: 'a' }],
            slot2: [{ title: 'x' }],
        });
        expect(r).toEqual({
            in: { logoUrl: 'a' },
            slot2: { title: 'x' },
        });
    });

    it('mergeMapperKeyedInputs throws when a port has multiple values', () => {
        expect(() =>
            mergeMapperKeyedInputs({
                in: [{ a: 1 }, { a: 2 }],
            }),
        ).toThrow(/at most one connection per input port/);
    });

    it('mergeIncomingGeneric flattens single object without duplicating port key', () => {
        const r = mergeIncomingGeneric({
            in: [{ logoUrl: 'u' }],
        });
        expect(r).toEqual({ logoUrl: 'u' });
        expect(Object.prototype.hasOwnProperty.call(r, 'in')).toBe(false);
    });
});
