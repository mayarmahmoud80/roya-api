import { Injectable, Logger } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ConnectorRegistry } from '../providers/connectors/connector.registry';
import { OpenAIService } from '../clients/openai/openai.service';
import { ConnectionsService } from '../connections/connections.service';
import { DataSource, DataSourceDocument } from '../data-sources/data-source.schema';
import { ReportTypeDocument } from '../report-types/report-type.schema';
import { ReportTypeVersion, ReportTypeVersionDocument } from '../report-types/report-type-version.schema';
import { Connection, ConnectionDocument } from '../connections/schemas/connection.schema';
import {
    BranchResultStatus,
    ND_MERGER_DEFINITION_SLUG,
    NodeCategory,
    NodeKind,
    ValidationIssueSeverity,
} from '../common/enums/builder-node.enum';
import { resolveCategory } from '../common/node-category-rules';
import { DynamicFlowMapperService } from './dynamic-flow-mapper.service';
import { mergeIncomingGeneric, mergeMapperKeyedInputs } from './dynamic-flow-port-merge.util';
import { NodeTry } from '../reports/types/execution-try.types';
import {
    NodeExecutionContext,
    NodeRuntime,
    SnapshotConnection,
    SnapshotNode,
} from './dynamic-flow-node-execution.types';
import {
    mergeOutputSchemaFromSnapshotNodes,
    normalizeTerminalPayloadToRecord,
    pickTerminalPayloadForReport,
    wrapOutputDataWithSchema,
} from './dynamic-flow-output-schema.util';
import { NodeExecutorRegistryService } from './dynamic-flow-node-executors.service';

/** Resolves a display string from snapshot `label`, localized `config.label`, or `name`. */
function snapshotNodeDisplayLabel(node: SnapshotNode): string | undefined {
    if (node.label && String(node.label).trim()) return node.label;
    const localized = node.config?.label;
    if (localized && typeof localized === 'object' && localized !== null) {
        const values = (localized as { values?: Record<string, string> }).values;
        if (values && typeof values === 'object') {
            const en = values['en']?.trim();
            if (en) return en;
            for (const v of Object.values(values)) {
                if (typeof v === 'string' && v.trim()) return v.trim();
            }
        }
    }
    return node.name;
}

interface ValidationIssuePayload extends Record<string, unknown> {
    code: string;
    path: string;
    message: { defaultLanguage: string; values: Record<string, string> };
    severity: ValidationIssueSeverity;
    nodeId?: string;
    connectionId?: string;
}

export interface DynamicFlowExecutionResult {
    /** Primary stored data: single terminal → its output; multiple → map of terminalKey→data. */
    data: Record<string, unknown> | null;
    branchResults: Array<Record<string, unknown>>;
    flowWarnings: ValidationIssuePayload[];
    requiredFailures: ValidationIssuePayload[];
    flowSnapshotVersion: number;
    /** Per-node execution trace for debugging; persisted as one "try" entry on the report. */
    nodeTries: NodeTry[];
}

@Injectable()
export class DynamicFlowExecutionService {
    private readonly logger = new Logger(DynamicFlowExecutionService.name);

    constructor(
        @InjectModel(ReportTypeVersion.name) private readonly versionModel: Model<ReportTypeVersionDocument>,
        @InjectModel(DataSource.name) private readonly dataSourceModel: Model<DataSourceDocument>,
        @InjectModel(Connection.name) private readonly connectionModel: Model<ConnectionDocument>,
        private readonly connectorRegistry: ConnectorRegistry,
        private readonly openaiService: OpenAIService,
        private readonly connectionsService: ConnectionsService,
        private readonly mapper: DynamicFlowMapperService,
        private readonly nodeExecutorRegistry: NodeExecutorRegistryService,
    ) {}

    /**
     * Execute the published dynamic flow snapshot as a DAG:
     *  - Topologically order nodes by connections
     *  - Each node produces outputs keyed by its output port
     *  - Downstream nodes consume values from incoming connections
     *  - Required-edge failures propagate to downstream required nodes; optional failures become warnings
     *  - Each AI provider and each terminal branch produces an independent result
     *
     * Throws when the report type has no published dynamic snapshot. Reports must be generated
     * from a published dynamic flow; legacy execution is no longer supported.
     */
    async runPublishedFlow(params: {
        reportType: ReportTypeDocument;
        organizationId: string;
        inputs: Record<string, unknown>;
    }): Promise<DynamicFlowExecutionResult> {
        const { reportType, organizationId, inputs } = params;
        if (!reportType.currentPublishedVersionId) {
            throw new Error(
                `Report type "${reportType.slug}" has no published version. Publish a dynamic flow before running analyses.`,
            );
        }
        const version = await this.versionModel.findById(reportType.currentPublishedVersionId).lean().exec();
        const snap = version?.publishedFlowSnapshot as Record<string, unknown> | undefined;
        if (!version) {
            throw new Error(
                `Report type "${reportType.slug}" points to a missing published version (${String(reportType.currentPublishedVersionId)}).`,
            );
        }
        if (!snap) {
            throw new Error(
                `Report type "${reportType.slug}" published version has no dynamic flow snapshot. Republish the report type to build one.`,
            );
        }

        const flowSnapshotVersion = Number(snap['snapshotVersion'] ?? 1);
        const nodes = (Array.isArray(snap['nodes']) ? snap['nodes'] : []) as SnapshotNode[];
        const connections = (Array.isArray(snap['connections']) ? snap['connections'] : []) as SnapshotConnection[];
        const nodeDefinitionDocs = (Array.isArray(snap['nodeDefinitions']) ? snap['nodeDefinitions'] : []) as Record<
            string,
            unknown
        >[];
        const definitionByAssetId = new Map<string, Record<string, unknown>>();
        for (const doc of nodeDefinitionDocs) {
            const id = String((doc as { _id?: unknown })._id ?? '');
            if (id) definitionByAssetId.set(id, doc);
        }

        this.logger.log(
            `Dynamic flow execution starting reportType=${reportType.slug} snapshot=${flowSnapshotVersion} nodes=${nodes.length} connections=${connections.length}`,
        );

        const flowWarnings: ValidationIssuePayload[] = [];
        const requiredFailures: ValidationIssuePayload[] = [];
        const branchResults: Array<Record<string, unknown>> = [];

        const nodeById = new Map<string, SnapshotNode>();
        for (const n of nodes) nodeById.set(n.nodeId, n);

        const incomingByNode = new Map<string, SnapshotConnection[]>();
        const outgoingByNode = new Map<string, SnapshotConnection[]>();
        for (const c of connections) {
            if (!incomingByNode.has(c.target.nodeId)) incomingByNode.set(c.target.nodeId, []);
            incomingByNode.get(c.target.nodeId)!.push(c);
            if (!outgoingByNode.has(c.source.nodeId)) outgoingByNode.set(c.source.nodeId, []);
            outgoingByNode.get(c.source.nodeId)!.push(c);
        }

        const order = this.topologicalOrder(nodes, connections);
        const runtime = new Map<string, NodeRuntime>();
        const nodeTries: NodeTry[] = [];

        const loadedConnections = await this.connectionModel.find({ organizationId: new Types.ObjectId(organizationId) }).exec();
        const connectionByProviderSlug = new Map(
            loadedConnections
                .filter((c) => !!c.providerSlug)
                .map((c) => [c.providerSlug as string, c]),
        );

        const openaiConnection = await this.connectionsService.findByProvider(organizationId, 'openai');
        const openaiKey = openaiConnection ? this.connectionsService.decryptKey(openaiConnection) : null;
        const openaiModel = openaiConnection?.config?.model;

        for (const node of order) {
            const incoming = incomingByNode.get(node.nodeId) ?? [];
            const nodeRequired = node.required !== false;
            const startedAt = new Date();
            // Snapshot resolved inputs (merged incoming by port) for the trace even if the node
            // is about to be skipped/failed from upstream propagation; empty object when no edges.
            const resolvedInputs = this.resolveInputsForNodeTrace(node, incoming, runtime, definitionByAssetId);
            const traceBase = {
                nodeId: node.nodeId,
                nodeKey: node.providerKey ?? node.nodeKind,
                nodeCategory: resolveCategory(node.category, node.nodeKind),
                label: snapshotNodeDisplayLabel(node),
                startedAt,
            };

            const propagated = this.checkUpstreamFailurePropagation(node, incoming, runtime, nodeRequired);
            if (propagated.outcome === 'failed') {
                runtime.set(node.nodeId, { status: 'failed', outputs: {}, errorCode: propagated.code, errorMessage: propagated.message });
                requiredFailures.push(this.issue(propagated.code, node.nodeId, propagated.message, ValidationIssueSeverity.ERROR));
                const finishedAt = new Date();
                nodeTries.push({
                    ...traceBase,
                    status: 'failed',
                    inputs: resolvedInputs,
                    finishedAt,
                    durationMs: finishedAt.getTime() - startedAt.getTime(),
                    errorCode: propagated.code,
                    errorMessage: propagated.message,
                });
                continue;
            }
            if (propagated.outcome === 'skipped') {
                runtime.set(node.nodeId, { status: 'skipped', outputs: {}, errorCode: propagated.code, errorMessage: propagated.message });
                flowWarnings.push(this.issue(propagated.code, node.nodeId, propagated.message, ValidationIssueSeverity.WARNING));
                const finishedAt = new Date();
                nodeTries.push({
                    ...traceBase,
                    status: 'skipped',
                    inputs: resolvedInputs,
                    finishedAt,
                    durationMs: finishedAt.getTime() - startedAt.getTime(),
                    errorCode: propagated.code,
                    errorMessage: propagated.message,
                });
                continue;
            }

            try {
                const outputs = await this.executeNode({
                    node,
                    incoming,
                    runtime,
                    inputs,
                    reportType,
                    connectionByProviderSlug,
                    openaiKey: openaiKey ?? undefined,
                    openaiModel,
                    definitionByAssetId,
                    helpers: {
                        connectorRegistry: this.connectorRegistry,
                        openaiService: this.openaiService,
                        connectionsService: this.connectionsService,
                        mapper: this.mapper,
                        dataSourceModel: this.dataSourceModel,
                    },
                });
                runtime.set(node.nodeId, { status: 'completed', outputs });
                const finishedAt = new Date();
                nodeTries.push({
                    ...traceBase,
                    status: 'completed',
                    inputs: resolvedInputs,
                    outputs,
                    finishedAt,
                    durationMs: finishedAt.getTime() - startedAt.getTime(),
                });
            } catch (err) {
                const msg = (err as Error).message ?? 'Unknown node error';
                const code = `node_execution_failed:${node.nodeKind}`;
                runtime.set(node.nodeId, { status: 'failed', outputs: {}, errorCode: code, errorMessage: msg });
                const issue = this.issue(code, node.nodeId, msg, ValidationIssueSeverity.ERROR);
                if (nodeRequired) {
                    requiredFailures.push(issue);
                } else {
                    flowWarnings.push({ ...issue, severity: ValidationIssueSeverity.WARNING });
                }
                const finishedAt = new Date();
                nodeTries.push({
                    ...traceBase,
                    status: 'failed',
                    inputs: resolvedInputs,
                    finishedAt,
                    durationMs: finishedAt.getTime() - startedAt.getTime(),
                    errorCode: code,
                    errorMessage: msg,
                });
                this.logger.warn(
                    `Dynamic flow node ${node.nodeId} (${node.nodeKind}) ${nodeRequired ? 'required' : 'optional'} failure: ${msg}`,
                );
            }
        }

        const mergedOutputSchema = mergeOutputSchemaFromSnapshotNodes(nodes);
        const terminalData: Record<string, unknown> = {};
        for (const node of nodes) {
            if (resolveCategory(node.category, node.nodeKind) !== NodeCategory.TERMINAL) continue;
            const rt = runtime.get(node.nodeId);
            const required = node.terminalConfig?.required ?? node.required ?? true;
            const terminalKey = node.terminalConfig?.terminalKey ?? node.nodeId;
            const pathId = `path-${node.nodeId}`;

            if (!rt || rt.status === 'failed' || rt.status === 'skipped') {
                const status =
                    rt?.status === 'skipped' || !required
                        ? BranchResultStatus.WARNING
                        : BranchResultStatus.FAILED;
                branchResults.push({
                    pathId,
                    terminalKey,
                    status,
                    required,
                    error: this.issue(
                        rt?.errorCode ?? 'terminal_unreached',
                        node.nodeId,
                        rt?.errorMessage ?? 'Terminal branch did not complete.',
                        status === BranchResultStatus.FAILED ? ValidationIssueSeverity.ERROR : ValidationIssueSeverity.WARNING,
                    ),
                    completedAt: new Date(),
                });
                continue;
            }

            const rawTerminal = rt.outputs['data'] ?? rt.outputs;
            const flatTerminal = normalizeTerminalPayloadToRecord(rawTerminal);
            const flatForReport = pickTerminalPayloadForReport(flatTerminal, mergedOutputSchema);
            const data = wrapOutputDataWithSchema(flatForReport, mergedOutputSchema)!;
            branchResults.push({
                pathId,
                terminalKey,
                status: BranchResultStatus.COMPLETED,
                required,
                data,
                completedAt: new Date(),
            });
            terminalData[terminalKey] = data;
        }

        let completedTerminals = branchResults.filter(b => b['status'] === BranchResultStatus.COMPLETED);
        let finalData: Record<string, unknown> | null = null;
        if (completedTerminals.length === 1) {
            const only = completedTerminals[0]!['data'];
            finalData = (only && typeof only === 'object' ? only : { result: only }) as Record<
                string,
                unknown
            >;
        } else if (completedTerminals.length > 1) {
            finalData = terminalData;
        } else if (nodes.length > 0) {
            const aiNodes = nodes.filter(n => resolveCategory(n.category, n.nodeKind) === NodeCategory.AI);
            for (const ai of aiNodes) {
                const rt = runtime.get(ai.nodeId);
                if (rt?.status === 'completed' && rt.outputs['result']) {
                    const rawAi = normalizeTerminalPayloadToRecord(rt.outputs['result']);
                    finalData = wrapOutputDataWithSchema(
                        pickTerminalPayloadForReport(rawAi, mergedOutputSchema),
                        mergedOutputSchema,
                    );
                    branchResults.push({
                        pathId: `path-ai-fallback-${ai.nodeId}`,
                        terminalKey: '__ai_output__',
                        status: BranchResultStatus.COMPLETED,
                        required: false,
                        data: finalData,
                        completedAt: new Date(),
                    });
                    break;
                }
            }
            completedTerminals = branchResults.filter(b => b['status'] === BranchResultStatus.COMPLETED);
        }

        if (requiredFailures.length > 0) {
            this.logger.warn(
                `Dynamic flow ${reportType.slug} finished with ${requiredFailures.length} required failure(s), ${flowWarnings.length} warning(s)`,
            );
            return { data: null, branchResults, flowWarnings, requiredFailures, flowSnapshotVersion, nodeTries };
        }

        this.logger.log(
            `Dynamic flow ${reportType.slug} completed. terminals=${branchResults.length} warnings=${flowWarnings.length}`,
        );
        return {
            data: finalData,
            branchResults,
            flowWarnings,
            requiredFailures,
            flowSnapshotVersion,
            nodeTries,
        };
    }

    /** Kahn's algorithm; falls back to input order if a cycle exists (validation would have blocked publication). */
    private topologicalOrder(nodes: SnapshotNode[], connections: SnapshotConnection[]): SnapshotNode[] {
        const inDegree = new Map<string, number>();
        const adj = new Map<string, string[]>();
        for (const n of nodes) {
            inDegree.set(n.nodeId, 0);
            adj.set(n.nodeId, []);
        }
        for (const c of connections) {
            if (!inDegree.has(c.target.nodeId) || !adj.has(c.source.nodeId)) continue;
            inDegree.set(c.target.nodeId, (inDegree.get(c.target.nodeId) ?? 0) + 1);
            adj.get(c.source.nodeId)!.push(c.target.nodeId);
        }
        const ready: string[] = [];
        for (const [id, deg] of inDegree) if (deg === 0) ready.push(id);
        const out: SnapshotNode[] = [];
        const seen = new Set<string>();
        while (ready.length) {
            const id = ready.shift()!;
            if (seen.has(id)) continue;
            seen.add(id);
            const node = nodes.find(n => n.nodeId === id);
            if (node) out.push(node);
            for (const next of adj.get(id) ?? []) {
                const d = (inDegree.get(next) ?? 0) - 1;
                inDegree.set(next, d);
                if (d <= 0) ready.push(next);
            }
        }
        if (out.length < nodes.length) {
            this.logger.warn(`Topological sort incomplete (possible cycle); processed ${out.length}/${nodes.length} nodes, appending remainder in insertion order.`);
            for (const n of nodes) if (!seen.has(n.nodeId)) out.push(n);
        }
        return out;
    }

    private checkUpstreamFailurePropagation(
        node: SnapshotNode,
        incoming: SnapshotConnection[],
        runtime: Map<string, NodeRuntime>,
        nodeRequired: boolean,
    ): { outcome: 'ok' | 'failed' | 'skipped'; code: string; message: string } {
        for (const conn of incoming) {
            const upstream = runtime.get(conn.source.nodeId);
            if (!upstream) continue;
            if (upstream.status === 'completed') continue;
            const connRequired = conn.required !== false;
            if (!connRequired) continue;
            if (nodeRequired) {
                return {
                    outcome: 'failed',
                    code: 'upstream_required_failure',
                    message: `Required upstream node "${conn.source.nodeId}" failed; cannot run node "${node.nodeId}".`,
                };
            }
            return {
                outcome: 'skipped',
                code: 'upstream_required_failure_optional_skipped',
                message: `Required upstream node "${conn.source.nodeId}" failed; optional node "${node.nodeId}" skipped.`,
            };
        }
        return { outcome: 'ok', code: '', message: '' };
    }

    private async executeNode(
        params: Omit<NodeExecutionContext, 'incomingByPort'>,
    ): Promise<Record<string, unknown>> {
        const ctx: NodeExecutionContext = {
            ...params,
            incomingByPort: this.collectIncomingByPort(params.incoming, params.runtime),
        };
        return this.nodeExecutorRegistry.execute(ctx);
    }

    /** Group incoming connections' source outputs by the receiving port. */
    private collectIncomingByPort(
        incoming: SnapshotConnection[],
        runtime: Map<string, NodeRuntime>,
    ): Record<string, unknown[]> {
        const byPort: Record<string, unknown[]> = {};
        for (const conn of incoming) {
            const src = runtime.get(conn.source.nodeId);
            if (!src || src.status !== 'completed') continue;
            const val = src.outputs[conn.source.portKey];
            if (val === undefined) continue;
            if (!byPort[conn.target.portKey]) byPort[conn.target.portKey] = [];
            byPort[conn.target.portKey]!.push(val);
        }
        return byPort;
    }

    private resolveInputsForNodeTrace(
        node: SnapshotNode,
        incoming: SnapshotConnection[],
        runtime: Map<string, NodeRuntime>,
        definitionByAssetId: Map<string, Record<string, unknown>>,
    ): Record<string, unknown> {
        const byPort = this.collectIncomingByPort(incoming, runtime);
        const category = resolveCategory(node.category, node.nodeKind as NodeKind | string);
        if (category !== NodeCategory.TRANSFORM) {
            return mergeIncomingGeneric(byPort);
        }
        const defId = node.definitionAssetId ? String(node.definitionAssetId) : '';
        const defDoc = defId ? definitionByAssetId.get(defId) : undefined;
        if (this.transformFlavor(node, defDoc) === 'merger') {
            return {
                in: this.collectMergerInboundArray(incoming, runtime),
            };
        }
        return mergeMapperKeyedInputs(byPort);
    }

    private collectMergerInboundArray(
        incoming: SnapshotConnection[],
        runtime: Map<string, NodeRuntime>,
    ): unknown[] {
        const merged: unknown[] = [];
        for (const conn of incoming) {
            const src = runtime.get(conn.source.nodeId);
            if (!src || src.status !== 'completed') continue;
            const value = src.outputs[conn.source.portKey];
            if (value === undefined) continue;
            merged.push(value);
        }
        return merged;
    }

    private transformFlavor(node: SnapshotNode, defDoc: Record<string, unknown> | undefined): 'merger' | 'mapper' {
        if (typeof node.nodeTypeKey === 'string' && node.nodeTypeKey.trim() === 'merger') {
            return 'merger';
        }
        const legacy = String(node.nodeKind);
        const nestedNodeTypeKey =
            defDoc &&
            typeof defDoc === 'object' &&
            typeof (defDoc['nodeDefinition'] as Record<string, unknown> | undefined)?.['nodeTypeKey'] === 'string'
                ? String((defDoc['nodeDefinition'] as Record<string, unknown>)['nodeTypeKey'])
                : undefined;
        if (
            legacy === 'merger' ||
            nestedNodeTypeKey === 'merger' ||
            (typeof defDoc?.['slug'] === 'string' && defDoc['slug'] === ND_MERGER_DEFINITION_SLUG)
        ) {
            return 'merger';
        }
        return 'mapper';
    }

    private issue(code: string, nodeId: string, message: string, severity: ValidationIssueSeverity): ValidationIssuePayload {
        return {
            code,
            path: `node:${nodeId}`,
            message: { defaultLanguage: 'en', values: { en: message } },
            severity,
            nodeId,
        };
    }
}
