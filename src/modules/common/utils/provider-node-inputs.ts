/**
 * Read port keys from the published node-definition asset: inputs from
 * `metadata.requiredInputKeys` / required `nodeDefinition.inputs`, outputs from
 * `metadata.outputKeys` / `nodeDefinition.outputs`. Optional snapshot `config.*InputKey`
 * remains a legacy fallback for inputs only where noted.
 */

import { NodeConnectionDirection } from '../enums/builder-node.enum';

/** Ordered required INPUT port keys from a BuilderAsset-shaped node definition document. */
export function getRequiredInputPortKeysFromBuilderAsset(def: Record<string, unknown> | undefined): string[] {
    if (!def) return [];
    const meta = def['metadata'] as Record<string, unknown> | undefined;
    const fromMeta = meta?.['requiredInputKeys'];
    if (Array.isArray(fromMeta)) {
        const keys = fromMeta.filter((k): k is string => typeof k === 'string' && Boolean(String(k).trim()));
        if (keys.length) return keys.map(k => k.trim());
    }
    const nd = def['nodeDefinition'] as Record<string, unknown> | undefined;
    const inputs = nd?.['inputs'] as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(inputs)) return [];
    return inputs
        .filter(
            p =>
                p['direction'] === NodeConnectionDirection.INPUT &&
                p['required'] === true &&
                typeof p['key'] === 'string' &&
                String(p['key']).trim(),
        )
        .map(p => String(p['key']).trim());
}

/** Ordered OUTPUT port keys from a BuilderAsset-shaped node definition document. */
export function getOutputPortKeysFromBuilderAsset(def: Record<string, unknown> | undefined): string[] {
    if (!def) return [];
    const meta = def['metadata'] as Record<string, unknown> | undefined;
    const fromMeta = meta?.['outputKeys'];
    if (Array.isArray(fromMeta)) {
        const keys = fromMeta.filter((k): k is string => typeof k === 'string' && Boolean(String(k).trim()));
        if (keys.length) return keys.map(k => k.trim());
    }
    const nd = def['nodeDefinition'] as Record<string, unknown> | undefined;
    const outputs = nd?.['outputs'] as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(outputs)) return [];
    return outputs
        .filter(
            p =>
                p['direction'] === NodeConnectionDirection.OUTPUT &&
                typeof p['key'] === 'string' &&
                String(p['key']).trim(),
        )
        .map(p => String(p['key']).trim());
}

/**
 * Primary string port for legacy one-input sources: first required key from the definition asset,
 * else `config[configFallbackField]`.
 */
export function resolvePrimaryRequiredInputPortKey(
    definitionAsset: Record<string, unknown> | undefined,
    config: Record<string, unknown> | undefined,
    configFallbackField: string,
    providerLabel: string,
): string {
    const fromDef = getRequiredInputPortKeysFromBuilderAsset(definitionAsset);
    if (fromDef.length >= 1) return fromDef[0];
    return requireConfigInputPortKey(config, configFallbackField, providerLabel);
}

export function requireConfigInputPortKey(
    config: Record<string, unknown> | undefined,
    configField: string,
    providerLabel: string,
): string {
    const v = config?.[configField];
    if (typeof v !== 'string' || !v.trim()) {
        throw new Error(
            `${providerLabel}: node config must set "${configField}" to the input port key (string) for this provider.`,
        );
    }
    return v.trim();
}

export function requireTrimmedStringAtPort(
    inputs: Record<string, unknown> | undefined,
    portKey: string,
    providerLabel: string,
): string {
    const v = inputs?.[portKey];
    if (typeof v !== 'string' || !v.trim()) {
        throw new Error(`${providerLabel}: input port "${portKey}" must be a non-empty string.`);
    }
    return v.trim();
}

export function optionalTrimmedStringAtPort(
    inputs: Record<string, unknown> | undefined,
    portKey: string,
): string | undefined {
    const v = inputs?.[portKey];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
