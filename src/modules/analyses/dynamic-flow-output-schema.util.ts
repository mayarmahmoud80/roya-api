import { NodeCategory, NodeKind } from '../common/enums/builder-node.enum';
import { resolveCategory } from '../common/node-category-rules';

/** Same closed vocabulary as the portal `OutputFieldType`. */
export const OUTPUT_FIELD_TYPES = [
    'text',
    'score',
    'tag',
    'list',
    'color',
    'color_scheme',
    'number',
    'url',
    'img',
    'currency',
    'column_chart',
] as const;

export type OutputFieldType = (typeof OUTPUT_FIELD_TYPES)[number];

/**
 * Maps builder / legacy strings to a known output field type; unknown → `text`.
 */
export function normalizeOutputFieldType(value: unknown): OutputFieldType {
    if (typeof value === 'string' && (OUTPUT_FIELD_TYPES as readonly string[]).includes(value)) {
        return value as OutputFieldType;
    }
    return 'text';
}

export interface SnapshotNodeLike {
    nodeId?: string;
    nodeKind?: NodeKind | string;
    category?: NodeCategory;
    config?: Record<string, unknown>;
}

/**
 * Merges `config.outputSchema` from every OUTPUT_SCHEMA snapshot node, matching
 * {@link ReportTypesService} attachDerivedLegacyFields (later SCHEMA nodes override keys).
 */
export function mergeOutputSchemaFromSnapshotNodes(nodes: readonly SnapshotNodeLike[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const node of nodes) {
        const category = resolveCategory(node.category, node.nodeKind);
        if (category !== NodeCategory.SCHEMA) continue;
        const cfg = (node.config ?? {}) as Record<string, unknown>;
        const cfgSchema = (cfg['outputSchema'] as Record<string, unknown> | undefined) ?? {};
        for (const [k, v] of Object.entries(cfgSchema)) {
            out[k] = typeof v === 'string' ? v : 'string';
        }
    }
    return out;
}

/**
 * True when the value is already a persisted typed cell `{ type, value }` (not an array).
 */
export function isTypedOutputCell(value: unknown): value is { type: string; value: unknown } {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    return 'type' in value && 'value' in value;
}

/**
 * Normalizes terminal output to a flat string-keyed record (primitives become `{ result }`).
 */
export function normalizeTerminalPayloadToRecord(raw: unknown): Record<string, unknown> {
    if (raw == null) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        return { ...(raw as Record<string, unknown>) };
    }
    return { result: raw };
}

/** Port keys duplicated by mergeIncoming alongside flattened fields; not persisted report fields. */
const RESERVED_TERMINAL_PAYLOAD_KEYS = new Set(['in', 'out']);

/**
 * Common source/transform wrappers: a single URL or string in `payload`, `url`, or `value`.
 */
export function normalizePortCellToScalar(cell: unknown): unknown {
    if (cell == null) return cell;
    if (typeof cell !== 'object' || Array.isArray(cell)) return cell;
    const o = cell as Record<string, unknown>;
    if (typeof o['payload'] === 'string') return o['payload'];
    if (typeof o['url'] === 'string') return o['url'];
    if (typeof o['value'] === 'string') return o['value'];
    return cell;
}

function tryUnwrapPortOnlyPayload(flat: Record<string, unknown>): Record<string, unknown> | null {
    const keys = Object.keys(flat);
    if (keys.length === 0 || !keys.every(k => RESERVED_TERMINAL_PAYLOAD_KEYS.has(k))) {
        return null;
    }
    const innerIn = flat['in'];
    if (Array.isArray(innerIn)) {
        return { items: innerIn };
    }
    if (innerIn != null && typeof innerIn === 'object') {
        return innerIn as Record<string, unknown>;
    }
    const innerOut = flat['out'];
    if (Array.isArray(innerOut)) {
        return { items: innerOut };
    }
    if (innerOut != null && typeof innerOut === 'object') {
        return innerOut as Record<string, unknown>;
    }
    return null;
}

/**
 * Finds a merger / port array in a terminal flat payload (incl. `items` from port-only unwrap).
 */
function extractOrderedCandidateArray(flat: Record<string, unknown>): unknown[] | null {
    const items = flat['items'];
    if (Array.isArray(items)) return items;
    const unwrapped = tryUnwrapPortOnlyPayload(flat);
    if (unwrapped) {
        return extractOrderedCandidateArray(unwrapped);
    }
    return null;
}

/**
 * When OUTPUT SCHEMA defines ordered fields (e.g. logo1, logo2 → img) but upstream is a single
 * array (merger → `in` / `items`), map schema keys in declaration order to array slots.
 */
function bindSchemaKeysToOrderedList(schema: Record<string, string>, arr: readonly unknown[]): Record<string, unknown> {
    const keys = Object.keys(schema);
    const out: Record<string, unknown> = {};
    const n = Math.min(keys.length, arr.length);
    for (let i = 0; i < n; i++) {
        const k = keys[i]!;
        out[k] = normalizePortCellToScalar(arr[i]);
    }
    return out;
}

/** Strips a trailing ` (type)` label often emitted by LLMs so keys align with OUTPUT SCHEMA names. */
function stripOutputFieldTypeLabel(key: string): string {
    return key.replace(/\s*\([^)]+\)\s*$/, '').trim();
}

/**
 * Resolves a value for an OUTPUT SCHEMA key: exact key wins, then first flat key whose base name
 * (after stripping ` (type)`) matches case-insensitively.
 */
function valueForOutputSchemaKey(flat: Record<string, unknown>, schemaKey: string): unknown {
    if (Object.prototype.hasOwnProperty.call(flat, schemaKey)) {
        return flat[schemaKey];
    }
    const want = schemaKey.trim().toLowerCase();
    for (const fk of Object.keys(flat)) {
        if (stripOutputFieldTypeLabel(fk).toLowerCase() === want) {
            return flat[fk];
        }
    }
    return undefined;
}

/**
 * Drops structural graph keys (`in` / `out`) and restricts to OUTPUT SCHEMA keys when defined.
 */
export function pickTerminalPayloadForReport(
    flat: Record<string, unknown>,
    schema: Record<string, string>,
): Record<string, unknown> {
    const schemaKeys = Object.keys(schema);
    let result: Record<string, unknown>;
    if (schemaKeys.length > 0) {
        const out: Record<string, unknown> = {};
        for (const k of schemaKeys) {
            const v = valueForOutputSchemaKey(flat, k);
            if (v !== undefined) {
                out[k] = v;
            }
        }
        if (Object.keys(out).length > 0) {
            result = out;
        } else {
            const inner = tryUnwrapPortOnlyPayload(flat);
            if (inner) {
                result = pickTerminalPayloadForReport(inner, schema);
            } else {
                result = out;
            }
        }
        if (Object.keys(result).length === 0) {
            const arr = extractOrderedCandidateArray(flat);
            if (arr && arr.length > 0) {
                result = bindSchemaKeysToOrderedList(schema, arr);
            }
        }
    } else {
        const out = { ...flat };
        for (const k of RESERVED_TERMINAL_PAYLOAD_KEYS) {
            delete out[k];
        }
        if (Object.keys(out).length > 0) {
            result = out;
        } else {
            const inner = tryUnwrapPortOnlyPayload(flat);
            if (inner) {
                result = pickTerminalPayloadForReport(inner, schema);
            } else {
                result = out;
            }
        }
    }
    return result;
}

/**
 * Resolves field type for persistence: explicit schema wins; otherwise infer arrays → `list`
 * so the report viewer uses array renderers (portal maps `list` → `array`).
 */
function wrapFieldType(schemaEntry: unknown, raw: unknown): OutputFieldType {
    if (typeof schemaEntry === 'string' && schemaEntry.trim() !== '') {
        return normalizeOutputFieldType(schemaEntry);
    }
    if (Array.isArray(raw)) {
        return 'list';
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return 'number';
    }
    return 'text';
}

/**
 * Wraps each top-level key into `{ type, value }` using the merged OUTPUT SCHEMA. Keys not in
 * `schema` infer a type from the value (arrays → `list`). Existing typed cells are left unchanged.
 */
export function wrapOutputDataWithSchema(
    data: Record<string, unknown> | null | undefined,
    schema: Record<string, string>,
): Record<string, unknown> | null {
    if (data == null) return null;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
        const raw = data[key];
        if (isTypedOutputCell(raw)) {
            out[key] = raw;
            continue;
        }
        const t = wrapFieldType(schema[key], raw);
        out[key] = { type: t, value: raw };
    }
    return out;
}
