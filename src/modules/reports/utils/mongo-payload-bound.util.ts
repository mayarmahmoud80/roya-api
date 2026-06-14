import { BSON } from 'bson';

/** BSON serialization hard cap (~0x1100000); MongoDB document ceiling is tight — probe well under. */
const TARGET_MAX_BSON_BYTES = 12 * 1024 * 1024;

function calculateSize(value: Record<string, unknown>): number {
    try {
        return BSON.calculateObjectSize(value);
    } catch {
        return TARGET_MAX_BSON_BYTES + 1;
    }
}

/**
 * Deep-truncates string leaves so persisted report payloads stay under BSON write limits — large
 * scraper / HTML blobs in traces or terminal output exceeded the MongoDB write buffer and surfaced
 * as RangeError (“offset … must be … <= 17825792”).
 */
export function truncateDeepStrings(value: unknown, maxCharsPerString: number): unknown {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'string') {
        if (value.length <= maxCharsPerString) {
            return value;
        }
        const omitted = value.length - maxCharsPerString;
        return `${value.slice(0, maxCharsPerString)}\n… [truncated ${omitted} characters]`;
    }
    if (typeof value !== 'object') {
        return value;
    }
    if (value instanceof Date) {
        return value;
    }
    if (Buffer.isBuffer(value)) {
        return { _truncatedBinary: true, byteLength: value.length };
    }
    if (Array.isArray(value)) {
        return value.map(v => truncateDeepStrings(v, maxCharsPerString));
    }
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
        out[k] = truncateDeepStrings(o[k], maxCharsPerString);
    }
    return out;
}

/**
 * Shrink a `{ ...mongo $set fields, __executionTry: Omit<..., 'tryNumber'> }`-shaped probe
 * until BSON encoding fits the driver limit.
 */
export function truncateMongoFlowProbeUntilFits<T extends Record<string, unknown>>(probe: T): T {
    let maxChars = 400_000;
    for (let i = 0; i < 28; i++) {
        const t = truncateDeepStrings(probe, maxChars);
        const rec = typeof t === 'object' && t !== null ? (t as Record<string, unknown>) : {};
        if (calculateSize(rec) <= TARGET_MAX_BSON_BYTES) {
            return rec as T;
        }
        maxChars = Math.max(512, Math.floor(maxChars / 2));
        if (i > 22) {
            maxChars = Math.max(256, Math.floor(maxChars / 2));
        }
    }
    return truncateDeepStrings(probe, 512) as T;
}
