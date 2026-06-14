/**
 * Port merge utilities for dynamic flow execution (SCHEMA/AI/TERMINAL vs Mapper vs Merger).
 */

export function mergeIncomingGeneric(byPort: Record<string, unknown[]>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [port, values] of Object.entries(byPort)) {
        if (values.length === 1) {
            const v = values[0];
            if (v != null && typeof v === 'object' && !Array.isArray(v)) {
                Object.assign(out, v as Record<string, unknown>);
            } else if (v !== undefined) {
                out[port] = v;
            }
        } else {
            const plain = values.filter(
                (v): v is Record<string, unknown> => v != null && typeof v === 'object' && !Array.isArray(v),
            );
            if (plain.length === values.length && plain.length > 0) {
                out[port] = Object.assign({}, ...plain);
            } else {
                out[port] = values;
            }
        }
    }
    return out;
}

/** Mapper: one value per input port → `{ [portKey]: value }` (no flattening to root). */
export function mergeMapperKeyedInputs(byPort: Record<string, unknown[]>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [port, values] of Object.entries(byPort)) {
        if (!values.length) continue;
        if (values.length > 1) {
            throw new Error(
                `Mapper node must have at most one connection per input port; port "${port}" has ${values.length}. Use a Merger node to combine multiple streams into an array.`,
            );
        }
        out[port] = values[0];
    }
    return out;
}
