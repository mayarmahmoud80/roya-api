import { NodeCategory, NodeKind } from '../common/enums/builder-node.enum';
import {
    isTypedOutputCell,
    mergeOutputSchemaFromSnapshotNodes,
    normalizeOutputFieldType,
    normalizePortCellToScalar,
    normalizeTerminalPayloadToRecord,
    pickTerminalPayloadForReport,
    wrapOutputDataWithSchema,
} from './dynamic-flow-output-schema.util';

describe('normalizeOutputFieldType', () => {
    it('returns known types', () => {
        expect(normalizeOutputFieldType('color')).toBe('color');
        expect(normalizeOutputFieldType('color_scheme')).toBe('color_scheme');
        expect(normalizeOutputFieldType('column_chart')).toBe('column_chart');
        expect(normalizeOutputFieldType('img')).toBe('img');
    });
    it('falls back to text for unknown', () => {
        expect(normalizeOutputFieldType('weird')).toBe('text');
        expect(normalizeOutputFieldType(null)).toBe('text');
    });
});

describe('mergeOutputSchemaFromSnapshotNodes', () => {
    it('merges SCHEMA nodes; later keys override', () => {
        const nodes = [
            {
                nodeKind: NodeKind.OUTPUT_SCHEMA,
                category: NodeCategory.SCHEMA,
                config: { outputSchema: { a: 'text', colorPalette: 'color' } },
            },
            {
                nodeKind: NodeKind.OUTPUT_SCHEMA,
                category: NodeCategory.SCHEMA,
                config: { outputSchema: { a: 'number' } },
            },
        ];
        expect(mergeOutputSchemaFromSnapshotNodes(nodes)).toEqual({
            a: 'number',
            colorPalette: 'color',
        });
    });
    it('coerces non-string schema values to string label', () => {
        const nodes = [
            {
                nodeKind: NodeKind.OUTPUT_SCHEMA,
                config: { outputSchema: { x: 42 as unknown as string } },
            },
        ];
        expect(mergeOutputSchemaFromSnapshotNodes(nodes)).toEqual({ x: 'string' });
    });
    it('ignores non-SCHEMA nodes', () => {
        const nodes = [{ nodeKind: NodeKind.AI_PROVIDER, config: { outputSchema: { no: 'text' } } }];
        expect(mergeOutputSchemaFromSnapshotNodes(nodes)).toEqual({});
    });
});

describe('wrapOutputDataWithSchema', () => {
    it('wraps each key with type from schema; unknown key → text', () => {
        expect(
            wrapOutputDataWithSchema({ colorPalette: '#a50034', extra: 'hi' }, { colorPalette: 'color' }),
        ).toEqual({
            colorPalette: { type: 'color', value: '#a50034' },
            extra: { type: 'text', value: 'hi' },
        });
    });
    it('leaves existing typed cells unchanged', () => {
        const cell = { type: 'color', value: '#fff' };
        expect(wrapOutputDataWithSchema({ x: cell }, {})).toEqual({ x: cell });
    });
    it('infers list for arrays when key is missing from schema (merger items)', () => {
        const arr = [{ payload: 'https://a.example/x' }, { payload: 'https://b.example/y' }];
        expect(wrapOutputDataWithSchema({ items: arr }, {})).toEqual({
            items: { type: 'list', value: arr },
        });
    });
    it('returns null for null/undefined data', () => {
        expect(wrapOutputDataWithSchema(null, {})).toBeNull();
        expect(wrapOutputDataWithSchema(undefined, {})).toBeNull();
    });
});

describe('normalizePortCellToScalar', () => {
    it('unwraps payload / url / value strings', () => {
        expect(normalizePortCellToScalar({ payload: 'https://x/a.png' })).toBe('https://x/a.png');
        expect(normalizePortCellToScalar({ url: 'https://x/b.png' })).toBe('https://x/b.png');
        expect(normalizePortCellToScalar({ value: 'https://x/c.png' })).toBe('https://x/c.png');
    });
    it('passes through primitives', () => {
        expect(normalizePortCellToScalar('plain')).toBe('plain');
    });
});

describe('normalizeTerminalPayloadToRecord', () => {
    it('wraps primitives as result', () => {
        expect(normalizeTerminalPayloadToRecord(5)).toEqual({ result: 5 });
    });
    it('clones plain objects', () => {
        const o = { a: 1 };
        const r = normalizeTerminalPayloadToRecord(o);
        expect(r).toEqual({ a: 1 });
        expect(r).not.toBe(o);
    });
});

describe('pickTerminalPayloadForReport', () => {
    it('keeps only schema keys when schema is non-empty', () => {
        const flat = {
            brand_strength: 9.6,
            logo: 'https://x/logo.svg',
            in: { brand_strength: 9.6, logo: 'https://x/logo.svg' },
        };
        expect(
            pickTerminalPayloadForReport(flat, { brand_strength: 'score', logo: 'img' }),
        ).toEqual({ brand_strength: 9.6, logo: 'https://x/logo.svg' });
    });
    it('maps LLM `Key (type)` labels to OUTPUT SCHEMA keys (e.g. Avatar (img) → Avatar)', () => {
        const flat = {
            in: {
                executiveSummary: 'summary',
                'Avatar (img)': 'https://i.pravatar.cc/150?u=miro',
            },
        };
        expect(
            pickTerminalPayloadForReport(flat, { executiveSummary: 'text', Avatar: 'img' }),
        ).toEqual({
            executiveSummary: 'summary',
            Avatar: 'https://i.pravatar.cc/150?u=miro',
        });
    });
    it('unwraps `in` when schema keys are only nested under the input port', () => {
        const flat = {
            in: { brand_strength: 9.6, logo: 'https://x/logo.svg' },
        };
        expect(
            pickTerminalPayloadForReport(flat, { brand_strength: 'score', logo: 'img' }),
        ).toEqual({ brand_strength: 9.6, logo: 'https://x/logo.svg' });
    });
    it('unwraps `in` when payload is port-only and schema is empty', () => {
        expect(pickTerminalPayloadForReport({ in: { ranking: 'a', chart: {} } }, {})).toEqual({
            ranking: 'a',
            chart: {},
        });
    });
    it('unwraps port-only `in` when it is an array (merger → terminal)', () => {
        const arr = [{ payload: 'https://i.pravatar.cc/150?u=zid' }, { payload: 'https://i.pravatar.cc/150?u=salla' }];
        expect(pickTerminalPayloadForReport({ in: arr }, {})).toEqual({ items: arr });
    });
    it('maps OUTPUT SCHEMA img keys to merger `in` array in order (payload cells)', () => {
        const schema = { logo1: 'img', logo2: 'img' };
        const flat = {
            in: [{ payload: 'https://i.pravatar.cc/150?u=zid' }, { payload: 'https://i.pravatar.cc/150?u=salla' }],
        };
        expect(pickTerminalPayloadForReport(flat, schema)).toEqual({
            logo1: 'https://i.pravatar.cc/150?u=zid',
            logo2: 'https://i.pravatar.cc/150?u=salla',
        });
        expect(
            wrapOutputDataWithSchema(
                pickTerminalPayloadForReport(flat, schema),
                schema,
            ),
        ).toEqual({
            logo1: { type: 'img', value: 'https://i.pravatar.cc/150?u=zid' },
            logo2: { type: 'img', value: 'https://i.pravatar.cc/150?u=salla' },
        });
    });
    it('drops in/out only when schema is empty', () => {
        expect(pickTerminalPayloadForReport({ a: 1, in: {}, out: {} }, {})).toEqual({ a: 1 });
    });
});

describe('isTypedOutputCell', () => {
    it('detects { type, value }', () => {
        expect(isTypedOutputCell({ type: 'url', value: 'https://x' })).toBe(true);
    });
    it('rejects arrays and null', () => {
        expect(isTypedOutputCell([1])).toBe(false);
        expect(isTypedOutputCell(null)).toBe(false);
    });
});
