import { Injectable } from '@nestjs/common';
import {
    MapperTransform,
    ND_MERGER_DEFINITION_SLUG,
    NodeCategory,
} from '../common/enums/builder-node.enum';
import { resolveCategory } from '../common/node-category-rules';
import { BUILDER_DATA_SOURCE_SLUG_TO_PROVIDER } from '../common/builder-data-source-providers';
import { catalogImplKeyToProviderSlug } from '../common/catalog-impl-key-to-provider-slug';
import { mergeIncomingGeneric, mergeMapperKeyedInputs } from './dynamic-flow-port-merge.util';
import { DynamicNodeExecutor, NodeExecutionContext } from './dynamic-flow-node-execution.types';

function modelFromProviderKey(providerKey?: string): string | undefined {
    if (!providerKey) return undefined;
    const idx = providerKey.indexOf(':');
    return idx >= 0 ? providerKey.slice(idx + 1) : undefined;
}

function pickLocalizedName(reportType: { name?: string; slug: string; localizedName?: unknown }): string {
    const plain = reportType.name;
    if (typeof plain === 'string' && plain.trim()) return plain.trim();
    const ln = reportType.localizedName as { defaultLanguage?: string; values?: Record<string, string> } | undefined;
    const lang = ln?.defaultLanguage ?? 'en';
    const v = ln?.values?.[lang] ?? ln?.values?.['en'];
    if (typeof v === 'string' && v.trim()) return v;
    return reportType.slug;
}

@Injectable()
export class InputNodeExecutor implements DynamicNodeExecutor {
    supports(ctx: NodeExecutionContext): boolean {
        return resolveCategory(ctx.node.category, ctx.node.nodeKind) === NodeCategory.INPUT;
    }

    async execute(ctx: NodeExecutionContext): Promise<Record<string, unknown>> {
        const cfg = (ctx.node.config ?? {}) as { inputKey?: string };
        const value = cfg.inputKey ? ctx.inputs[cfg.inputKey] : { ...ctx.inputs };
        return { value };
    }
}

@Injectable()
export class SourceNodeExecutor implements DynamicNodeExecutor {
    supports(ctx: NodeExecutionContext): boolean {
        const category = resolveCategory(ctx.node.category, ctx.node.nodeKind);
        return category === NodeCategory.SOURCE || ctx.node.builderCategoryKey === 'acquisition' || ctx.node.builderCategoryKey === 'enrichment';
    }

    async execute(ctx: NodeExecutionContext): Promise<Record<string, unknown>> {
        const providerSlug = this.resolveSourceProviderSlug(ctx.node);
        if (!providerSlug) {
            throw new Error(`Data source node "${ctx.node.nodeId}" has no providerKey and no legacy dataSourceSlug config.`);
        }
        const connection = ctx.connectionByProviderSlug.get(providerSlug);
        const connector = ctx.helpers.connectorRegistry.get(providerSlug);

        const declaredInputs: Record<string, unknown> = {};
        for (const [port, values] of Object.entries(ctx.incomingByPort)) {
            declaredInputs[port] = values.length === 1 ? values[0] : values;
        }
        const bucket: Record<string, unknown> = {};
        const defId = ctx.node.definitionAssetId ? String(ctx.node.definitionAssetId) : '';
        const definitionAsset = defId ? ctx.definitionByAssetId.get(defId) : undefined;
        await connector.execute({
            inputs: declaredInputs,
            config: (ctx.node.config ?? {}) as Record<string, unknown>,
            definitionAsset,
            connection,
            context: bucket,
            requiredByDefault: ctx.node.required !== false,
        });
        const portOutputs: Record<string, unknown> = { payload: bucket };
        for (const [key, value] of Object.entries(bucket)) {
            if (key === 'payload') continue;
            portOutputs[key] = value;
        }
        return portOutputs;
    }

    private resolveSourceProviderSlug(node: NodeExecutionContext['node']): string | undefined {
        if (node.providerKey) {
            const raw = node.providerKey.split(':')[0];
            return catalogImplKeyToProviderSlug(raw) ?? raw;
        }
        const cfg = (node.config ?? {}) as { dataSourceSlug?: string };
        if (cfg.dataSourceSlug) {
            return BUILDER_DATA_SOURCE_SLUG_TO_PROVIDER[cfg.dataSourceSlug];
        }
        return undefined;
    }
}

@Injectable()
export class TransformNodeExecutor implements DynamicNodeExecutor {
    supports(ctx: NodeExecutionContext): boolean {
        return resolveCategory(ctx.node.category, ctx.node.nodeKind) === NodeCategory.TRANSFORM;
    }

    async execute(ctx: NodeExecutionContext): Promise<Record<string, unknown>> {
        const defId = ctx.node.definitionAssetId ? String(ctx.node.definitionAssetId) : '';
        const defDoc = defId ? ctx.definitionByAssetId.get(defId) : undefined;
        if (this.transformFlavor(ctx.node, defDoc) === 'merger') {
            const mergedList = this.collectMergerInboundArray(ctx.incoming, ctx.runtime);
            return { out: mergedList };
        }
        const rules = ctx.node.mapperRules ?? [];
        const merged = mergeMapperKeyedInputs(ctx.incomingByPort);
        const normalized = rules.map(r => ({
            targetPath: r.targetPath,
            sourcePath: r.sourcePath,
            transform: r.transform ?? MapperTransform.DIRECT,
            parameters: r.parameters,
            required: Boolean(r.required),
        }));
        const transformed = rules.length ? ctx.helpers.mapper.applyRules(merged, normalized) : merged;
        return { out: transformed };
    }

    private collectMergerInboundArray(incoming: NodeExecutionContext['incoming'], runtime: NodeExecutionContext['runtime']): unknown[] {
        const out: unknown[] = [];
        for (const conn of incoming) {
            const src = runtime.get(conn.source.nodeId);
            if (!src || src.status !== 'completed') continue;
            const val = src.outputs[conn.source.portKey];
            if (val === undefined) continue;
            out.push(val);
        }
        return out;
    }

    private transformFlavor(node: NodeExecutionContext['node'], defDoc: Record<string, unknown> | undefined): 'merger' | 'mapper' {
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
}

@Injectable()
export class SchemaNodeExecutor implements DynamicNodeExecutor {
    supports(ctx: NodeExecutionContext): boolean {
        return resolveCategory(ctx.node.category, ctx.node.nodeKind) === NodeCategory.SCHEMA;
    }

    async execute(ctx: NodeExecutionContext): Promise<Record<string, unknown>> {
        const merged = mergeIncomingGeneric(ctx.incomingByPort);
        const cfg = (ctx.node.config ?? {}) as { outputSchema?: Record<string, unknown> };
        return {
            schema: {
                data: merged,
                outputSchema: cfg.outputSchema ?? {},
            },
        };
    }
}

@Injectable()
export class AiNodeExecutor implements DynamicNodeExecutor {
    supports(ctx: NodeExecutionContext): boolean {
        return resolveCategory(ctx.node.category, ctx.node.nodeKind) === NodeCategory.AI || ctx.node.builderCategoryKey === 'reasoning';
    }

    async execute(ctx: NodeExecutionContext): Promise<Record<string, unknown>> {
        const merged = mergeIncomingGeneric(ctx.incomingByPort);
        const aiContext = (merged['data'] as Record<string, unknown>) ?? merged;
        const upstreamSchema =
            (merged['outputSchema'] as Record<string, unknown> | undefined) ??
            ((merged['schema'] as { outputSchema?: Record<string, unknown> } | undefined)?.outputSchema);
        const nodeCfg = (ctx.node.config ?? {}) as {
            outputSchema?: Record<string, unknown>;
            temperature?: number;
            instruction?: string;
            promptSubjectInputKey?: string;
        };
        const outputSchema = upstreamSchema ?? nodeCfg.outputSchema ?? {};
        const modelOverride = modelFromProviderKey(ctx.node.providerKey) ?? ctx.openaiModel;
        const displayName = pickLocalizedName(ctx.reportType);
        const subjectKey =
            typeof nodeCfg.promptSubjectInputKey === 'string' ? nodeCfg.promptSubjectInputKey.trim() : '';
        const promptSubject =
            subjectKey && typeof ctx.inputs[subjectKey] === 'string'
                ? (ctx.inputs[subjectKey] as string).trim()
                : '';
        const result = await ctx.helpers.openaiService.generateReport(
            { slug: ctx.reportType.slug, outputSchema, name: displayName },
            aiContext as Record<string, unknown>,
            { apiKey: ctx.openaiKey, model: modelOverride, inputs: ctx.inputs, promptSubject },
        );
        return { result };
    }
}

@Injectable()
export class TerminalNodeExecutor implements DynamicNodeExecutor {
    supports(ctx: NodeExecutionContext): boolean {
        return resolveCategory(ctx.node.category, ctx.node.nodeKind) === NodeCategory.TERMINAL || ctx.node.builderCategoryKey === 'delivery';
    }

    async execute(ctx: NodeExecutionContext): Promise<Record<string, unknown>> {
        const merged = mergeIncomingGeneric(ctx.incomingByPort);
        const mode = ctx.node.terminalConfig?.outputMode;
        const data = (() => {
            if (mode === 'aiResult' && merged['result']) return merged['result'];
            if (mode === 'schemaResult' && merged['data']) return merged['data'];
            if (merged['result']) return merged['result'];
            if (merged['data']) return merged['data'];
            if (merged['schema']) return merged['schema'];
            return merged;
        })();
        return { data };
    }
}

@Injectable()
export class PassthroughNodeExecutor implements DynamicNodeExecutor {
    supports(): boolean {
        return true;
    }

    async execute(ctx: NodeExecutionContext): Promise<Record<string, unknown>> {
        return { passthrough: mergeIncomingGeneric(ctx.incomingByPort) };
    }
}

@Injectable()
export class NodeExecutorRegistryService {
    constructor(
        private readonly input: InputNodeExecutor,
        private readonly source: SourceNodeExecutor,
        private readonly transform: TransformNodeExecutor,
        private readonly schema: SchemaNodeExecutor,
        private readonly ai: AiNodeExecutor,
        private readonly terminal: TerminalNodeExecutor,
        private readonly passthrough: PassthroughNodeExecutor,
    ) {}

    private executors(): DynamicNodeExecutor[] {
        return [this.input, this.source, this.transform, this.schema, this.ai, this.terminal, this.passthrough];
    }

    async execute(ctx: NodeExecutionContext): Promise<Record<string, unknown>> {
        const executor = this.executors().find(candidate => candidate.supports(ctx)) ?? this.passthrough;
        return executor.execute(ctx);
    }
}
