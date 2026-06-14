import { NodeCategory, NodeKind } from '../common/enums/builder-node.enum';
import { resolveCategory } from '../common/node-category-rules';
import { FlowValidationResultPayload } from './dynamic-flow-validation.types';
import { FlowConnectionPlain, FlowNodePlain } from './dynamic-flow-graph.validation';

export interface SnapshotTerminalPath {
    pathId: string;
    terminalNodeId: string;
    nodeIds: string[];
    required: boolean;
    outputKey: string;
}

/**
 * Finds one simple path from entry nodes to each terminal (for publication metadata).
 */
export function computeTerminalPaths(nodes: FlowNodePlain[], connections: FlowConnectionPlain[]): SnapshotTerminalPath[] {
    const incoming = new Map<string, number>();
    for (const c of connections) {
        incoming.set(c.target.nodeId, (incoming.get(c.target.nodeId) ?? 0) + 1);
    }
    const roots = nodes
        .filter(n => !incoming.has(n.nodeId) || resolveCategory(n.category, n.nodeKind) === NodeCategory.INPUT)
        .map(n => n.nodeId);
    const adj = new Map<string, string[]>();
    for (const n of nodes) {
        adj.set(n.nodeId, []);
    }
    for (const c of connections) {
        adj.get(c.source.nodeId)?.push(c.target.nodeId);
    }

    const paths: SnapshotTerminalPath[] = [];
    for (const term of nodes.filter(n => resolveCategory(n.category, n.nodeKind) === NodeCategory.TERMINAL)) {
        const found = bfsPath(roots, term.nodeId, adj);
        if (found.length) {
            paths.push({
                pathId: `path-${term.nodeId}`,
                terminalNodeId: term.nodeId,
                nodeIds: found,
                required: term.terminalConfig?.required ?? term.required,
                outputKey: term.terminalConfig?.terminalKey ?? term.nodeId,
            });
        }
    }
    return paths;
}

function bfsPath(roots: string[], target: string, adj: Map<string, string[]>): string[] {
    const q: { id: string; path: string[] }[] = roots.map(r => ({ id: r, path: [r] }));
    const seen = new Set<string>();
    while (q.length) {
        const { id, path } = q.shift()!;
        if (id === target) {
            return path;
        }
        if (seen.has(id)) {
            continue;
        }
        seen.add(id);
        for (const next of adj.get(id) ?? []) {
            q.push({ id: next, path: [...path, next] });
        }
    }
    return [];
}

export function buildPublishedFlowSnapshot(params: {
    defaultLanguage: string;
    flowNodes: unknown[];
    flowConnections: unknown[];
    nodeDefinitionDocs: Array<Record<string, unknown>>;
    validationSummary: FlowValidationResultPayload;
}): Record<string, unknown> {
    const nodes = params.flowNodes as FlowNodePlain[];
    const connections = params.flowConnections as FlowConnectionPlain[];
    const terminalPaths = computeTerminalPaths(nodes, connections);

    const defByAssetId = new Map<string, Record<string, unknown>>();
    for (const doc of params.nodeDefinitionDocs) {
        const id = String((doc as { _id?: unknown })._id ?? '');
        if (id) {
            defByAssetId.set(id, doc);
        }
    }

    /**
     * Enrich each stored node with `category` and `providerKey` copied from its node definition
     * at publish time so the runtime executor can dispatch without re-loading the definition
     * and swapping a provider in the palette cannot change already-published behavior.
     */
    const enrichedNodes = params.flowNodes.map(n => {
        const node = n as Record<string, unknown>;
        const defId = String(node['definitionAssetId'] ?? '');
        const def = (defByAssetId.get(defId)?.['nodeDefinition'] as Record<string, unknown> | undefined) ?? undefined;
        const category = resolveCategory(
            (node['category'] ?? def?.['category']) as NodeCategory | undefined,
            (node['nodeKind'] ?? def?.['nodeKind']) as NodeKind | undefined,
        );
        const providerKey = (node['providerKey'] ?? def?.['providerKey']) as string | undefined;
        const builderCategoryKey = (node['builderCategoryKey'] ?? def?.['builderCategoryKey']) as string | undefined;
        const nodeTypeKey = (node['nodeTypeKey'] ?? def?.['nodeTypeKey']) as string | undefined;
        return {
            ...node,
            ...(category ? { category } : {}),
            ...(builderCategoryKey ? { builderCategoryKey } : {}),
            ...(nodeTypeKey ? { nodeTypeKey } : {}),
            ...(providerKey ? { providerKey } : {}),
        };
    });

    return {
        snapshotVersion: 1,
        publishedAt: new Date(),
        defaultLanguage: params.defaultLanguage || 'en',
        nodeDefinitions: params.nodeDefinitionDocs,
        nodes: enrichedNodes,
        connections: params.flowConnections,
        terminalPaths,
        validationSummary: params.validationSummary,
    };
}
