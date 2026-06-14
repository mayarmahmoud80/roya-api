import { Types } from 'mongoose';
import {
    BuilderNodeExecutionRole,
    BuilderValueType,
    FlowValidationTargetType,
    MapperTransform,
    ND_MAPPER_DEFINITION_SLUG,
    ND_MERGER_DEFINITION_SLUG,
    NodeCategory,
    NodeConnectionDirection,
    NodeKind,
    ValidationIssueSeverity,
} from '../common/enums/builder-node.enum';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';
import { BuilderAssetType } from '../common/enums/builder-asset-type.enum';
import { isCategoryPairAllowed, resolveCategory } from '../common/node-category-rules';
import { DynamicValidationIssue, FlowValidationResultPayload, flowIssue } from './dynamic-flow-validation.types';

export interface ConnectionPointContract {
    key: string;
    direction: NodeConnectionDirection;
    valueType: BuilderValueType;
    required: boolean;
    minConnections: number;
    maxConnections?: number;
    compatibleNodeKinds?: NodeKind[];
    compatibleNodeTypeKeys?: string[];
    compatibleValueTypes: BuilderValueType[];
}

export interface NodeDefinitionContract {
    assetId: string;
    /** BuilderAsset slug — distinguishes mapper vs merger when {@link NodeKind.TRANSFORM}. */
    slug?: string;
    nodeKind: NodeKind;
    category: NodeCategory;
    builderCategoryKey: string;
    nodeTypeKey?: string;
    providerKey?: string;
    status: BuilderAssetStatus;
    inputs: ConnectionPointContract[];
    outputs: ConnectionPointContract[];
    allowedSourceKinds?: NodeKind[];
    allowedSourceNodeTypeKeys?: string[];
    allowedTargetKinds?: NodeKind[];
    allowedTargetNodeTypeKeys?: string[];
    executionRole: BuilderNodeExecutionRole;
}

export interface FlowNodePlain {
    nodeId: string;
    definitionAssetId: unknown;
    nodeKind: NodeKind;
    category?: NodeCategory;
    builderCategoryKey?: string;
    nodeTypeKey?: string;
    required: boolean;
    /**
     * Optional slug from the portal registry (`availableNodeDefinitions`) — used when Mongo catalog rows omit or
     * duplicate {@link NodeDefinitionContract.slug} so merger (`nd-merger`) multi-wire validation still applies.
     */
    definitionSlug?: string;
    mapperRules?: Array<{
        ruleId: string;
        sourcePath?: string;
        targetPath: string;
        transform: MapperTransform;
        parameters?: Record<string, unknown>;
        required: boolean;
    }>;
    terminalConfig?: {
        terminalKey: string;
        required: boolean;
        acceptedSourceKinds: NodeKind[];
        acceptedSourceNodeTypeKeys?: string[];
        outputMode: string;
    };
}

export interface FlowConnectionPlain {
    connectionId: string;
    source: { nodeId: string; portKey: string };
    target: { nodeId: string; portKey: string };
    required: boolean;
}

const SECRET_KEY_SUBSTRINGS = ['password', 'secret', 'token', 'apikey', 'api_key', 'privatekey', 'credential', 'authorization'];

/** Maps persisted legacy wire values to {@link NodeKind}; Mongo may still hold `mapper` / `merger` on old assets. */
function normalizeWireNodeKind(kind: unknown): NodeKind {
    const s = String(kind);
    if (s === 'mapper' || s === 'merger') {
        return NodeKind.TRANSFORM;
    }
    return kind as NodeKind;
}

/**
 * Mapper (`nd-mapper`) declares extra slots (`slot2` …); merger does not.
 */
function hasMapperSlotPorts(inputs: ConnectionPointContract[]): boolean {
    return inputs.some(p => /^slot\d+$/i.test(p.key));
}

/** Ports missing `direction` still behave as inputs unless explicitly OUTPUT (Mongo / legacy rows). */
function isLikelyInputPort(p: ConnectionPointContract): boolean {
    const d = p.direction as string | undefined;
    if (d == null) return true;
    const dl = String(d).toLowerCase();
    return dl !== NodeConnectionDirection.OUTPUT && dl !== 'output';
}

/**
 * Merger (`nd-merger`) allows multiple wires to `in`. Mapper shares {@link NodeKind.TRANSFORM} but always
 * adds `slot2`… ports. Shape detection must not depend on ARRAY `out` or perfect port metadata — catalog
 * rows are sometimes copied or edited and omit direction or mis-declare types.
 */
function mergerSlugFromFlowNode(def: NodeDefinitionContract, n: FlowNodePlain): string | undefined {
    const extra = (n as { definitionSlug?: unknown }).definitionSlug;
    const fromFlow = typeof extra === 'string' && extra.trim().length ? extra.trim() : undefined;
    return def.slug ?? fromFlow;
}

function isMergerMultiWireCatalogAsset(slug: string | undefined, nodeKind: NodeKind, inputs: ConnectionPointContract[]): boolean {
    if (slug === ND_MERGER_DEFINITION_SLUG) {
        return true;
    }
    if (nodeKind !== NodeKind.TRANSFORM) {
        return false;
    }
    if (hasMapperSlotPorts(inputs)) {
        return false;
    }
    const inputPorts = inputs.filter(isLikelyInputPort);
    return inputPorts.length === 1 && inputPorts[0]?.key === 'in';
}

function hasSecretKey(obj: unknown, path = ''): string | null {
    if (obj == null) return null;
    if (typeof obj !== 'object') return null;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const lower = k.toLowerCase();
        if (SECRET_KEY_SUBSTRINGS.some(s => lower.includes(s))) {
            return path ? `${path}.${k}` : k;
        }
        if (v && typeof v === 'object') {
            const inner = hasSecretKey(v, path ? `${path}.${k}` : k);
            if (inner) return inner;
        }
    }
    return null;
}

export function findSecretLikeKeyInConfig(config: unknown): string | null {
    return hasSecretKey(config, 'config');
}

export function nodeDefinitionFromAsset(
    doc: { _id: unknown; slug?: string; assetType: string; status: BuilderAssetStatus; nodeDefinition?: Record<string, unknown> },
): NodeDefinitionContract | null {
    if (doc.assetType !== BuilderAssetType.NODE_DEFINITION || !doc.nodeDefinition) {
        return null;
    }
    const raw = doc.nodeDefinition;
    const nodeKind = normalizeWireNodeKind(raw['nodeKind']);
    let inputs = (Array.isArray(raw['inputs']) ? raw['inputs'] : []) as ConnectionPointContract[];
    const outputs = (Array.isArray(raw['outputs']) ? raw['outputs'] : []) as ConnectionPointContract[];
    const executionRole = raw['executionRole'] as BuilderNodeExecutionRole;
    const category = resolveCategory(raw['category'] as NodeCategory | undefined, nodeKind);
    if (!category) {
        return null;
    }
    const builderCategoryKeyRaw = raw['builderCategoryKey'];
    const nodeTypeKeyRaw = raw['nodeTypeKey'];
    const builderCategoryKey =
        typeof builderCategoryKeyRaw === 'string' && builderCategoryKeyRaw.trim().length > 0
            ? builderCategoryKeyRaw.trim()
            : category;
    const nodeTypeKey =
        typeof nodeTypeKeyRaw === 'string' && nodeTypeKeyRaw.trim().length > 0 ? nodeTypeKeyRaw.trim() : undefined;
    const slugRaw = (doc as { slug?: unknown }).slug;
    let slug: string | undefined;
    if (slugRaw == null) {
        slug = undefined;
    } else if (typeof slugRaw === 'string') {
        const t = slugRaw.trim();
        slug = t.length ? t : undefined;
    } else {
        const t = String(slugRaw).trim();
        slug = t.length ? t : undefined;
    }
    /** Merger collects many upstream edges on one `in` port; DB copies from mapper sometimes set maxConnections: 1. */
    const mergerMultiWire = isMergerMultiWireCatalogAsset(slug, nodeKind, inputs);
    if (mergerMultiWire) {
        inputs = inputs.map(p => {
            if (p.key !== 'in' || p.maxConnections == null) return p;
            const { maxConnections: _drop, ...rest } = p;
            return rest as ConnectionPointContract;
        });
    }
    return {
        assetId: String(doc._id),
        ...(slug ? { slug } : {}),
        nodeKind,
        category,
        builderCategoryKey,
        ...(nodeTypeKey ? { nodeTypeKey } : {}),
        providerKey: (raw['providerKey'] as string | undefined) ?? undefined,
        status: doc.status,
        inputs,
        outputs,
        allowedSourceKinds: raw['allowedSourceKinds'] as NodeKind[] | undefined,
        allowedSourceNodeTypeKeys: raw['allowedSourceNodeTypeKeys'] as string[] | undefined,
        allowedTargetKinds: raw['allowedTargetKinds'] as NodeKind[] | undefined,
        allowedTargetNodeTypeKeys: raw['allowedTargetNodeTypeKeys'] as string[] | undefined,
        executionRole,
    };
}

function pointByKey(ports: ConnectionPointContract[], key: string, direction: NodeConnectionDirection): ConnectionPointContract | undefined {
    return ports.find(p => p.key === key && p.direction === direction);
}

function valueTypesCompatible(
    outType: BuilderValueType,
    inType: BuilderValueType,
    targetPoint: ConnectionPointContract,
): boolean {
    if (inType === BuilderValueType.ANY || outType === BuilderValueType.ANY) {
        return true;
    }
    if (targetPoint.compatibleValueTypes?.length) {
        return targetPoint.compatibleValueTypes.includes(outType) || targetPoint.compatibleValueTypes.includes(BuilderValueType.ANY);
    }
    return outType === inType;
}

function kindsCompatible(
    sourceDef: NodeDefinitionContract,
    targetDef: NodeDefinitionContract,
    outPoint: ConnectionPointContract,
    inPoint: ConnectionPointContract,
): boolean {
    const sourceKind = sourceDef.nodeKind;
    const targetKind = targetDef.nodeKind;
    if (
        inPoint.compatibleNodeTypeKeys?.length &&
        (!sourceDef.nodeTypeKey || !inPoint.compatibleNodeTypeKeys.includes(sourceDef.nodeTypeKey))
    ) {
        return false;
    }
    if (
        outPoint.compatibleNodeTypeKeys?.length &&
        (!targetDef.nodeTypeKey || !outPoint.compatibleNodeTypeKeys.includes(targetDef.nodeTypeKey))
    ) {
        return false;
    }
    if (
        targetDef.allowedSourceNodeTypeKeys?.length &&
        (!sourceDef.nodeTypeKey || !targetDef.allowedSourceNodeTypeKeys.includes(sourceDef.nodeTypeKey))
    ) {
        return false;
    }
    if (
        sourceDef.allowedTargetNodeTypeKeys?.length &&
        (!targetDef.nodeTypeKey || !sourceDef.allowedTargetNodeTypeKeys.includes(targetDef.nodeTypeKey))
    ) {
        return false;
    }
    if (inPoint.compatibleNodeKinds?.length && !inPoint.compatibleNodeKinds.includes(sourceKind)) {
        return false;
    }
    if (outPoint.compatibleNodeKinds?.length && !outPoint.compatibleNodeKinds.includes(targetKind)) {
        return false;
    }
    if (targetDef.allowedSourceKinds?.length && !targetDef.allowedSourceKinds.includes(sourceKind)) {
        return false;
    }
    if (sourceDef.allowedTargetKinds?.length && !sourceDef.allowedTargetKinds.includes(targetKind)) {
        return false;
    }
    return true;
}

function categoriesCompatible(sourceDef: NodeDefinitionContract, targetDef: NodeDefinitionContract): boolean {
    return isCategoryPairAllowed(sourceDef.category, targetDef.category);
}

function terminalSourcesCompatible(node: FlowNodePlain, sourceDef: NodeDefinitionContract): boolean {
    const acceptedKinds = node.terminalConfig?.acceptedSourceKinds ?? [];
    const acceptedNodeTypes = node.terminalConfig?.acceptedSourceNodeTypeKeys ?? [];

    if (acceptedNodeTypes.length > 0) {
        if (!sourceDef.nodeTypeKey || !acceptedNodeTypes.includes(sourceDef.nodeTypeKey)) {
            return false;
        }
    }
    if (acceptedKinds.length > 0 && !acceptedKinds.includes(sourceDef.nodeKind)) {
        return false;
    }
    return true;
}

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

/** Directed cycle detection (DFS with recursion stack / gray set). */
function hasCycle(nodeIds: Set<string>, connections: FlowConnectionPlain[]): boolean {
    const color = new Map<string, number>();
    for (const n of nodeIds) color.set(n, WHITE);

    const dfs = (u: string): boolean => {
        color.set(u, GRAY);
        for (const c of connections) {
            if (c.source.nodeId !== u) continue;
            const v = c.target.nodeId;
            if (!nodeIds.has(v)) continue;
            if (color.get(v) === GRAY) {
                return true;
            }
            if (color.get(v) === WHITE && dfs(v)) {
                return true;
            }
        }
        color.set(u, BLACK);
        return false;
    };

    for (const n of nodeIds) {
        if (color.get(n) === WHITE && dfs(n)) {
            return true;
        }
    }
    return false;
}

function validateMapperRules(
    node: FlowNodePlain,
    def: NodeDefinitionContract,
    upstreamOutputKeys: Set<string>,
    issues: DynamicValidationIssue[],
): void {
    for (const rule of node.mapperRules ?? []) {
        if (rule.transform === MapperTransform.DIRECT && rule.required) {
            if (rule.sourcePath && !upstreamOutputKeys.has(rule.sourcePath) && !upstreamOutputKeys.has(rule.sourcePath.split('.')[0] ?? '')) {
                issues.push(
                    flowIssue(
                        'mapper_missing_source',
                        `flowNodes.${node.nodeId}.mapperRules.${rule.ruleId}`,
                        `Source path "${rule.sourcePath}" is not present on upstream outputs.`,
                    ),
                );
            }
        }
        if (rule.transform === MapperTransform.FILTER && !rule.parameters?.['field']) {
            issues.push(
                flowIssue(
                    'mapper_filter_needs_field',
                    `flowNodes.${node.nodeId}.mapperRules.${rule.ruleId}`,
                    'Filter transform requires a "field" parameter.',
                ),
            );
        }
    }
}

export function validateDynamicFlowGraph(input: {
    flowNodes: FlowNodePlain[];
    flowConnections: FlowConnectionPlain[];
    definitionByAssetId: Map<string, NodeDefinitionContract>;
    categoryPolicy?: Map<string, string[]>;
}): FlowValidationResultPayload {
    const { flowNodes, flowConnections, definitionByAssetId, categoryPolicy } = input;
    const blocking: DynamicValidationIssue[] = [];
    const warnings: DynamicValidationIssue[] = [];
    const now = new Date();

    if (flowNodes.length === 0) {
        return {
            targetType: FlowValidationTargetType.REPORT_FLOW,
            blockingErrors: [flowIssue('flow_empty', 'flowNodes', 'Add at least one node to the flow.', ValidationIssueSeverity.ERROR)],
            warnings: [],
            graphStats: { nodeCount: 0, connectionCount: 0, terminalPathCount: 0 },
            checkedAt: now,
        };
    }

    const nodeById = new Map<string, FlowNodePlain>();
    const seenIds = new Set<string>();
    for (const n of flowNodes) {
        if (seenIds.has(n.nodeId)) {
            blocking.push(flowIssue('duplicate_node_id', `flowNodes.${n.nodeId}.nodeId`, 'Node ids must be unique within the flow.'));
        }
        seenIds.add(n.nodeId);
        nodeById.set(n.nodeId, n);
    }

    const defForNode = (n: FlowNodePlain): NodeDefinitionContract | undefined => {
        const id = String(n.definitionAssetId);
        return definitionByAssetId.get(id);
    };

    for (const n of flowNodes) {
        const def = defForNode(n);
        if (!def) {
            blocking.push(
                flowIssue(
                    'unknown_node_definition',
                    `flowNodes.${n.nodeId}.definitionAssetId`,
                    'The node definition asset was not found or is invalid.',
                    ValidationIssueSeverity.ERROR,
                    { nodeId: n.nodeId },
                ),
            );
            continue;
        }
        if (def.status !== BuilderAssetStatus.ACTIVE) {
            blocking.push(
                flowIssue(
                    'node_definition_inactive',
                    `flowNodes.${n.nodeId}.definitionAssetId`,
                    'The node definition is not active and cannot be used in draft editing.',
                    ValidationIssueSeverity.ERROR,
                    { nodeId: n.nodeId },
                ),
            );
        }
        const nk = String(n.nodeKind);
        const normalizedFlowKind =
            nk === 'mapper' || nk === 'merger' ? NodeKind.TRANSFORM : (n.nodeKind as NodeKind);
        if (def.nodeKind !== normalizedFlowKind) {
            blocking.push(
                flowIssue(
                    'node_kind_mismatch',
                    `flowNodes.${n.nodeId}.nodeKind`,
                    'Declared node kind does not match the selected definition.',
                    ValidationIssueSeverity.ERROR,
                    { nodeId: n.nodeId },
                ),
            );
        }
        if (n.category != null && def.category !== n.category) {
            blocking.push(
                flowIssue(
                    'node_category_mismatch',
                    `flowNodes.${n.nodeId}.category`,
                    'Declared node category does not match the selected definition.',
                    ValidationIssueSeverity.ERROR,
                    { nodeId: n.nodeId },
                ),
            );
        }
        if (n.builderCategoryKey && def.builderCategoryKey !== n.builderCategoryKey) {
            /** Persisted flows often stored {@link NodeCategory} (`source`, `input`) as `builderCategoryKey`
             * before taxonomy keys (`acquisition`, `intake`) existed on definitions. Accept that legacy shape
             * when it matches semantic category and the catalog now uses a separate builder key. */
            const defCategoryStr = String(def.category);
            const legacyFlowUsedSemanticCategoryAsBuilderKey =
                n.builderCategoryKey === defCategoryStr && def.builderCategoryKey !== defCategoryStr;
            if (!legacyFlowUsedSemanticCategoryAsBuilderKey) {
                blocking.push(
                    flowIssue(
                        'builder_category_key_mismatch',
                        `flowNodes.${n.nodeId}.builderCategoryKey`,
                        'Declared builder category key does not match the selected definition.',
                        ValidationIssueSeverity.ERROR,
                        { nodeId: n.nodeId },
                    ),
                );
            }
        }
        if (n.nodeTypeKey && def.nodeTypeKey !== n.nodeTypeKey) {
            blocking.push(
                flowIssue(
                    'node_type_key_mismatch',
                    `flowNodes.${n.nodeId}.nodeTypeKey`,
                    'Declared node type key does not match the selected definition.',
                    ValidationIssueSeverity.ERROR,
                    { nodeId: n.nodeId },
                ),
            );
        }
    }

    const seenConn = new Set<string>();
    for (const c of flowConnections) {
        if (seenConn.has(c.connectionId)) {
            blocking.push(flowIssue('duplicate_connection_id', `flowConnections.${c.connectionId}`, 'Connection ids must be unique.'));
        }
        seenConn.add(c.connectionId);
    }

    for (const c of flowConnections) {
        const from = nodeById.get(c.source.nodeId);
        const to = nodeById.get(c.target.nodeId);
        if (!from) {
            blocking.push(
                flowIssue(
                    'connection_unknown_source',
                    `flowConnections.${c.connectionId}.source`,
                    'Source node was not found.',
                    ValidationIssueSeverity.ERROR,
                    { connectionId: c.connectionId },
                ),
            );
            continue;
        }
        if (!to) {
            blocking.push(
                flowIssue(
                    'connection_unknown_target',
                    `flowConnections.${c.connectionId}.target`,
                    'Target node was not found.',
                    ValidationIssueSeverity.ERROR,
                    { connectionId: c.connectionId },
                ),
            );
            continue;
        }
        const fromDef = defForNode(from);
        const toDef = defForNode(to);
        if (!fromDef || !toDef) continue;

        const outPoint = pointByKey(fromDef.outputs, c.source.portKey, NodeConnectionDirection.OUTPUT);
        const inPoint = pointByKey(toDef.inputs, c.target.portKey, NodeConnectionDirection.INPUT);
        if (!outPoint) {
            blocking.push(
                flowIssue(
                    'port_not_output',
                    `flowConnections.${c.connectionId}.source.portKey`,
                    `Output port "${c.source.portKey}" is not defined on the source node.`,
                    ValidationIssueSeverity.ERROR,
                    { connectionId: c.connectionId, nodeId: from.nodeId },
                ),
            );
            continue;
        }
        if (!inPoint) {
            blocking.push(
                flowIssue(
                    'port_not_input',
                    `flowConnections.${c.connectionId}.target.portKey`,
                    `Input port "${c.target.portKey}" is not defined on the target node.`,
                    ValidationIssueSeverity.ERROR,
                    { connectionId: c.connectionId, nodeId: to.nodeId },
                ),
            );
            continue;
        }
        if (!valueTypesCompatible(outPoint.valueType, inPoint.valueType, inPoint)) {
            blocking.push(
                flowIssue(
                    'incompatible_value_types',
                    `flowConnections.${c.connectionId}`,
                    `Value type ${outPoint.valueType} is not compatible with target port (expects ${inPoint.valueType}).`,
                    ValidationIssueSeverity.ERROR,
                    { connectionId: c.connectionId },
                ),
            );
        }
        if (resolveCategory(to.category ?? toDef.category, to.nodeKind ?? toDef.nodeKind) === NodeCategory.TERMINAL && !terminalSourcesCompatible(to, fromDef)) {
            blocking.push(
                flowIssue(
                    'terminal_source_not_accepted',
                    `flowConnections.${c.connectionId}`,
                    'This terminal does not accept input from the selected source node type.',
                    ValidationIssueSeverity.ERROR,
                    { connectionId: c.connectionId, nodeId: to.nodeId },
                ),
            );
        }
        const allowedCategoryKeys = categoryPolicy?.get(fromDef.builderCategoryKey);
        const categoriesAllowed =
            !allowedCategoryKeys || allowedCategoryKeys.length === 0
                ? categoriesCompatible(fromDef, toDef)
                : allowedCategoryKeys.includes(toDef.builderCategoryKey);
        if (!categoriesAllowed) {
            blocking.push(
                flowIssue(
                    'incompatible_node_categories',
                    `flowConnections.${c.connectionId}`,
                    `Nodes of category "${fromDef.builderCategoryKey}" cannot feed nodes of category "${toDef.builderCategoryKey}".`,
                    ValidationIssueSeverity.ERROR,
                    { connectionId: c.connectionId },
                ),
            );
        } else if (!kindsCompatible(fromDef, toDef, outPoint, inPoint)) {
            blocking.push(
                flowIssue(
                    'incompatible_node_kinds',
                    `flowConnections.${c.connectionId}`,
                    'These node kinds are not allowed to connect by definition rules.',
                    ValidationIssueSeverity.ERROR,
                    { connectionId: c.connectionId },
                ),
            );
        }
    }

    // Cardinality: count per port
    const inCount = new Map<string, number>();
    for (const c of flowConnections) {
        const k = `${c.target.nodeId}::${c.target.portKey}`;
        inCount.set(k, (inCount.get(k) ?? 0) + 1);
    }
    for (const n of flowNodes) {
        const def = defForNode(n);
        if (!def) continue;
        for (const port of def.inputs) {
            const k = `${n.nodeId}::${port.key}`;
            const nConn = inCount.get(k) ?? 0;
            if (port.minConnections > 0 && nConn < port.minConnections) {
                blocking.push(
                    flowIssue(
                        'missing_required_input',
                        `flowNodes.${n.nodeId}.inputs.${port.key}`,
                        `Input "${port.key}" needs at least ${port.minConnections} connection(s).`,
                        ValidationIssueSeverity.ERROR,
                        { nodeId: n.nodeId },
                    ),
                );
            }
            if (port.maxConnections != null && nConn > port.maxConnections) {
                if (port.key === 'in' && isMergerMultiWireCatalogAsset(mergerSlugFromFlowNode(def, n), def.nodeKind, def.inputs)) {
                    continue;
                }
                blocking.push(
                    flowIssue(
                        'too_many_connections',
                        `flowNodes.${n.nodeId}.inputs.${port.key}`,
                        `Input "${port.key}" allows at most ${port.maxConnections} connection(s).`,
                        ValidationIssueSeverity.ERROR,
                        { nodeId: n.nodeId },
                    ),
                );
            }
        }
    }

    // Reachability from inputField / source nodes
    const nodeIdSet = new Set(flowNodes.map(n => n.nodeId));
    const terminalNodes = flowNodes.filter(
        n => resolveCategory(n.category, n.nodeKind) === NodeCategory.TERMINAL,
    );
    if (terminalNodes.length === 0) {
        blocking.push(flowIssue('no_terminal', 'flowNodes', 'At least one terminal node is required.'));
    }

    const incoming = new Set<string>();
    for (const c of flowConnections) {
        incoming.add(c.target.nodeId);
    }
    const isInputRoot = (n: FlowNodePlain) => {
        const def = defForNode(n);
        return resolveCategory(def?.category ?? n.category, def?.nodeKind ?? n.nodeKind) === NodeCategory.INPUT;
    };
    const roots = flowNodes.filter(n => !incoming.has(n.nodeId) || isInputRoot(n));
    const reached = new Set<string>();
    const q = [...roots.map(r => r.nodeId)];
    while (q.length) {
        const u = q.shift()!;
        if (reached.has(u)) continue;
        reached.add(u);
        for (const c of flowConnections) {
            if (c.source.nodeId === u) {
                q.push(c.target.nodeId);
            }
        }
    }
    for (const n of flowNodes) {
        if (!reached.has(n.nodeId) && resolveCategory(n.category, n.nodeKind) !== NodeCategory.TERMINAL) {
            warnings.push(
                flowIssue('unreachable_node', `flowNodes.${n.nodeId}`, 'This node is not reachable from the entry of the flow.', ValidationIssueSeverity.WARNING, {
                    nodeId: n.nodeId,
                }),
            );
        }
    }
    for (const t of terminalNodes) {
        if (!reached.has(t.nodeId)) {
            blocking.push(
                flowIssue('terminal_unreachable', `flowNodes.${t.nodeId}`, 'Terminal is not connected from the rest of the graph.', ValidationIssueSeverity.ERROR, {
                    nodeId: t.nodeId,
                }),
            );
        }
    }

    if (hasCycle(nodeIdSet, flowConnections)) {
        blocking.push(flowIssue('cycle_detected', 'flowConnections', 'The flow must not contain directed cycles.'));
    }

    // Mapper validation — mapper-rules apply only to nd-mapper transform definitions (not merger).
    for (const n of flowNodes) {
        const def = defForNode(n);
        if (!def) continue;
        const nk = String(n.nodeKind);
        if (nk === 'merger' || isMergerMultiWireCatalogAsset(mergerSlugFromFlowNode(def, n), def.nodeKind, def.inputs)) continue;

        const needsMapperRules =
            nk === 'mapper' ||
            def.slug === ND_MAPPER_DEFINITION_SLUG ||
            (nk === NodeKind.TRANSFORM &&
                def.slug != null &&
                def.slug !== ND_MERGER_DEFINITION_SLUG);

        if (!needsMapperRules) continue;

        const upstream = new Set<string>();
        for (const c of flowConnections) {
            if (c.target.nodeId !== n.nodeId) continue;
            const from = nodeById.get(c.source.nodeId);
            if (!from) continue;
            const fromDef = defForNode(from);
            if (!fromDef) continue;
            const op = pointByKey(fromDef.outputs, c.source.portKey, NodeConnectionDirection.OUTPUT);
            if (op) upstream.add(op.key);
        }
        validateMapperRules(n, def, upstream, blocking);
    }

    let terminalPathCount = 0;
    for (const t of terminalNodes) {
        if (reached.has(t.nodeId)) terminalPathCount += 1;
    }

    return {
        targetType: FlowValidationTargetType.REPORT_FLOW,
        blockingErrors: blocking,
        warnings,
        graphStats: {
            nodeCount: flowNodes.length,
            connectionCount: flowConnections.length,
            terminalPathCount,
        },
        checkedAt: now,
    };
}

export function buildDefinitionMap(assets: Array<{ _id: Types.ObjectId; assetType: string; status: BuilderAssetStatus; nodeDefinition?: Record<string, unknown> }>): Map<string, NodeDefinitionContract> {
    const m = new Map<string, NodeDefinitionContract>();
    for (const a of assets) {
        const d = nodeDefinitionFromAsset(a);
        if (d) {
            m.set(d.assetId, d);
        }
    }
    return m;
}
