import { Types } from 'mongoose';
import type { SampleDynamicFlowSeed, DynamicReportExampleSeed } from '../types';

/**
 * Resolves `dynamicFlow` on JSON seed data to persisted version fields.
 * Takes a resolver callback that maps slug → ObjectId from the BuilderAsset collection.
 */
export function buildSampleDynamicFlowFields(
    seed: { dynamicFlow: SampleDynamicFlowSeed },
    resolveAssetId: (slug: string) => Types.ObjectId,
): {
    flowNodes: Record<string, unknown>[];
    flowConnections: Record<string, unknown>[];
} {
    const df = seed.dynamicFlow;
    const flowNodes = df.flowNodes.map(n => ({
        nodeId: n.nodeId,
        definitionAssetId: resolveAssetId(n.definitionAssetSlug),
        nodeKind: n.nodeKind,
        required: n.required,
        ...(n.config ? { config: n.config } : {}),
        ...(n.mapperRules !== undefined ? { mapperRules: n.mapperRules } : {}),
        ...(n.terminalConfig ? { terminalConfig: n.terminalConfig } : {}),
        ...(n.position ? { position: n.position } : {}),
    }));
    const flowConnections = df.flowConnections.map(c => ({
        connectionId: c.connectionId,
        source: c.source,
        target: c.target,
        required: c.required,
    }));
    return { flowNodes, flowConnections };
}

/**
 * Resolves dynamic report example flow fields from JSON seed data.
 */
export function buildDynamicExampleFlowFields(
    seed: DynamicReportExampleSeed,
    resolveAssetId: (slug: string) => Types.ObjectId,
): {
    flowNodes: Record<string, unknown>[];
    flowConnections: Record<string, unknown>[];
} {
    return {
        flowNodes: seed.dynamicFlow.flowNodes.map(n => ({
            nodeId: n.nodeId,
            definitionAssetId: resolveAssetId(n.definitionAssetSlug),
            nodeKind: n.nodeKind,
            required: n.required,
            ...(n.config ? { config: n.config } : {}),
            ...(n.mapperRules !== undefined ? { mapperRules: n.mapperRules } : {}),
            ...(n.terminalConfig ? { terminalConfig: n.terminalConfig } : {}),
            ...(n.position ? { position: n.position } : {}),
        })),
        flowConnections: seed.dynamicFlow.flowConnections.map(c => ({
            connectionId: c.connectionId,
            source: c.source,
            target: c.target,
            required: c.required,
        })),
    };
}
