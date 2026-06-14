import { Types } from 'mongoose';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';
import { BuilderAssetType } from '../common/enums/builder-asset-type.enum';
import {
    BuilderNodeExecutionRole,
    BuilderValueType,
    ND_MAPPER_DEFINITION_SLUG,
    ND_MERGER_DEFINITION_SLUG,
    NodeCategory,
    NodeConnectionDirection,
    NodeKind,
} from '../common/enums/builder-node.enum';
import { buildDefinitionMap, validateDynamicFlowGraph } from './dynamic-flow-graph.validation';

describe('dynamic-flow-graph validation mapper/merger', () => {
    const asset = (
        slug: string,
        kind: NodeKind,
        inputs: Array<Record<string, unknown>>,
        outputs: Array<Record<string, unknown>>,
        exec: BuilderNodeExecutionRole,
        cat: NodeCategory,
    ) =>
        ({
            _id: new Types.ObjectId(),
            assetType: BuilderAssetType.NODE_DEFINITION,
            status: BuilderAssetStatus.ACTIVE,
            slug,
            nodeDefinition: {
                nodeKind: kind,
                category: cat,
                inputs,
                outputs,
                executionRole: exec,
            },
        }) as Parameters<typeof buildDefinitionMap>[0][number];

    const srcOut = [
        {
            key: 'payload',
            direction: NodeConnectionDirection.OUTPUT,
            valueType: BuilderValueType.OBJECT,
            label: { defaultLanguage: 'en', values: { en: 'payload' } },
            required: true,
            minConnections: 0,
            compatibleValueTypes: [BuilderValueType.OBJECT, BuilderValueType.ANY],
        },
    ];

    const mapperIn = [
        {
            key: 'in',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.OBJECT,
            label: { defaultLanguage: 'en', values: { en: 'in' } },
            required: true,
            minConnections: 0,
            maxConnections: 1,
            compatibleValueTypes: [BuilderValueType.OBJECT, BuilderValueType.ANY],
        },
    ];

    /** Minimal nd-mapper inputs: `in` plus one slot — real catalog has slot2…slot6 (merger has neither). */
    const mapperInputsWithSlot = [
        ...mapperIn,
        {
            key: 'slot2',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.OBJECT,
            label: { defaultLanguage: 'en', values: { en: 'slot2' } },
            required: false,
            minConnections: 0,
            maxConnections: 1,
            compatibleValueTypes: [BuilderValueType.OBJECT, BuilderValueType.ANY],
        },
    ];

    const mapperOut = [
        {
            key: 'out',
            direction: NodeConnectionDirection.OUTPUT,
            valueType: BuilderValueType.OBJECT,
            label: { defaultLanguage: 'en', values: { en: 'out' } },
            required: true,
            minConnections: 0,
            compatibleValueTypes: [BuilderValueType.OBJECT],
        },
    ];

    /** Simulates stale Mongo rows where merger copied mapper-style maxConnections on `in`. */
    const mergerInStaleMapperCap = [
        {
            key: 'in',
            direction: NodeConnectionDirection.INPUT,
            valueType: BuilderValueType.OBJECT,
            label: { defaultLanguage: 'en', values: { en: 'in' } },
            required: false,
            minConnections: 0,
            maxConnections: 1,
            compatibleValueTypes: [BuilderValueType.OBJECT, BuilderValueType.ANY],
        },
    ];

    const mergerOut = [
        {
            key: 'out',
            direction: NodeConnectionDirection.OUTPUT,
            valueType: BuilderValueType.ARRAY,
            label: { defaultLanguage: 'en', values: { en: 'out' } },
            required: true,
            minConnections: 0,
            compatibleValueTypes: [BuilderValueType.ARRAY, BuilderValueType.OBJECT, BuilderValueType.ANY],
        },
    ];

    it('blocks mapper when two edges hit the same input port', () => {
        const defs = buildDefinitionMap([
            asset('nd-src', NodeKind.DATA_SOURCE, [], srcOut, BuilderNodeExecutionRole.SOURCE, NodeCategory.SOURCE),
            asset('nd-mapper', NodeKind.TRANSFORM, mapperInputsWithSlot, mapperOut, BuilderNodeExecutionRole.TRANSFORM, NodeCategory.TRANSFORM),
        ]);
        const srcDef = [...defs.entries()].find(([, v]) => v.nodeKind === NodeKind.DATA_SOURCE)![0];
        const mapperDef = [...defs.entries()].find(([, v]) => v.slug === ND_MAPPER_DEFINITION_SLUG)![0];

        const flowNodes = [
            { nodeId: 's1', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, required: true },
            { nodeId: 's2', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, required: true },
            {
                nodeId: 'm1',
                definitionAssetId: mapperDef,
                nodeKind: NodeKind.TRANSFORM,
                required: true,
                mapperRules: [{ ruleId: 'r', targetPath: 'x', transform: 'direct' as never, required: false }],
            },
        ];
        const flowConnections = [
            {
                connectionId: 'e1',
                source: { nodeId: 's1', portKey: 'payload' },
                target: { nodeId: 'm1', portKey: 'in' },
                required: true,
            },
            {
                connectionId: 'e2',
                source: { nodeId: 's2', portKey: 'payload' },
                target: { nodeId: 'm1', portKey: 'in' },
                required: true,
            },
        ];
        const r = validateDynamicFlowGraph({ flowNodes, flowConnections, definitionByAssetId: defs });
        expect(r.blockingErrors.some(e => e.code === 'too_many_connections')).toBe(true);
    });

    it('allows merger multi-wire to `in` even when catalog asset wrongly had maxConnections: 1', () => {
        const defs = buildDefinitionMap([
            asset('nd-src', NodeKind.DATA_SOURCE, [], srcOut, BuilderNodeExecutionRole.SOURCE, NodeCategory.SOURCE),
            asset(
                ND_MERGER_DEFINITION_SLUG,
                NodeKind.TRANSFORM,
                mergerInStaleMapperCap,
                mergerOut,
                BuilderNodeExecutionRole.TRANSFORM,
                NodeCategory.TRANSFORM,
            ),
        ]);
        const srcDef = [...defs.entries()].find(([, v]) => v.nodeKind === NodeKind.DATA_SOURCE)![0];
        const mergerDef = [...defs.entries()].find(([, v]) => v.slug === ND_MERGER_DEFINITION_SLUG)![0];

        const flowNodes = [
            { nodeId: 's1', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, required: true },
            { nodeId: 's2', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, required: true },
            { nodeId: 's3', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, required: true },
            { nodeId: 'mg', definitionAssetId: mergerDef, nodeKind: NodeKind.TRANSFORM, required: true },
        ];
        const flowConnections = [
            { connectionId: 'e1', source: { nodeId: 's1', portKey: 'payload' }, target: { nodeId: 'mg', portKey: 'in' }, required: true },
            { connectionId: 'e2', source: { nodeId: 's2', portKey: 'payload' }, target: { nodeId: 'mg', portKey: 'in' }, required: true },
            { connectionId: 'e3', source: { nodeId: 's3', portKey: 'payload' }, target: { nodeId: 'mg', portKey: 'in' }, required: true },
        ];
        const r = validateDynamicFlowGraph({ flowNodes, flowConnections, definitionByAssetId: defs });
        expect(r.blockingErrors.filter(e => e.code === 'too_many_connections')).toHaveLength(0);
    });

    it('does not emit node_kind_mismatch when Mongo asset still stores legacy merger kind string', () => {
        const defs = buildDefinitionMap([
            asset(
                ND_MERGER_DEFINITION_SLUG,
                'merger' as unknown as NodeKind,
                mergerInStaleMapperCap,
                mergerOut,
                BuilderNodeExecutionRole.TRANSFORM,
                NodeCategory.TRANSFORM,
            ),
        ]);
        const mergerDef = [...defs.entries()].find(([, v]) => v.slug === ND_MERGER_DEFINITION_SLUG)![0];
        const flowNodes = [{ nodeId: 'mg', definitionAssetId: mergerDef, nodeKind: NodeKind.TRANSFORM, required: true }];
        const r = validateDynamicFlowGraph({ flowNodes, flowConnections: [], definitionByAssetId: defs });
        expect(r.blockingErrors.filter(e => e.code === 'node_kind_mismatch')).toHaveLength(0);
        expect(defs.get(String(mergerDef))!.nodeKind).toBe(NodeKind.TRANSFORM);
    });

    it('allows merger multi-wire when BuilderAsset omits slug but ports match merger (single `in`, ARRAY `out`)', () => {
        const defs = buildDefinitionMap([
            asset('nd-src', NodeKind.DATA_SOURCE, [], srcOut, BuilderNodeExecutionRole.SOURCE, NodeCategory.SOURCE),
            {
                _id: new Types.ObjectId(),
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                nodeDefinition: {
                    nodeKind: NodeKind.TRANSFORM,
                    category: NodeCategory.TRANSFORM,
                    inputs: mergerInStaleMapperCap,
                    outputs: mergerOut,
                    executionRole: BuilderNodeExecutionRole.TRANSFORM,
                },
            } as Parameters<typeof buildDefinitionMap>[0][number],
        ]);
        const srcDef = [...defs.entries()].find(([, v]) => v.nodeKind === NodeKind.DATA_SOURCE)![0];
        const mergerDef = [...defs.entries()].find(([, v]) => v.slug === undefined && v.outputs.some(o => o.valueType === BuilderValueType.ARRAY))![0];

        const flowNodes = [
            { nodeId: 's1', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, required: true },
            { nodeId: 's2', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, required: true },
            { nodeId: 'mg', definitionAssetId: mergerDef, nodeKind: NodeKind.TRANSFORM, required: true },
        ];
        const flowConnections = [
            { connectionId: 'e1', source: { nodeId: 's1', portKey: 'payload' }, target: { nodeId: 'mg', portKey: 'in' }, required: true },
            { connectionId: 'e2', source: { nodeId: 's2', portKey: 'payload' }, target: { nodeId: 'mg', portKey: 'in' }, required: true },
        ];
        const r = validateDynamicFlowGraph({ flowNodes, flowConnections, definitionByAssetId: defs });
        expect(r.blockingErrors.filter(e => e.code === 'too_many_connections')).toHaveLength(0);
    });

    it('blocks connections when target definition restricts allowedSourceNodeTypeKeys', () => {
        const defs = buildDefinitionMap([
            {
                _id: new Types.ObjectId(),
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                slug: 'nd-source-web-scraper',
                nodeDefinition: {
                    nodeKind: NodeKind.DATA_SOURCE,
                    category: NodeCategory.SOURCE,
                    builderCategoryKey: 'acquisition',
                    nodeTypeKey: 'web-scraper',
                    inputs: [],
                    outputs: srcOut,
                    executionRole: BuilderNodeExecutionRole.SOURCE,
                },
            } as Parameters<typeof buildDefinitionMap>[0][number],
            {
                _id: new Types.ObjectId(),
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                slug: 'nd-reasoning-special',
                nodeDefinition: {
                    nodeKind: NodeKind.AI_PROVIDER,
                    category: NodeCategory.AI,
                    builderCategoryKey: 'reasoning',
                    nodeTypeKey: 'structured-ai-generator',
                    allowedSourceNodeTypeKeys: ['openai-research-source'],
                    inputs: [
                        {
                            key: 'data',
                            direction: NodeConnectionDirection.INPUT,
                            valueType: BuilderValueType.OBJECT,
                            label: { defaultLanguage: 'en', values: { en: 'data' } },
                            required: true,
                            minConnections: 1,
                            compatibleValueTypes: [BuilderValueType.OBJECT, BuilderValueType.ANY],
                        },
                    ],
                    outputs: [
                        {
                            key: 'result',
                            direction: NodeConnectionDirection.OUTPUT,
                            valueType: BuilderValueType.RESULT,
                            label: { defaultLanguage: 'en', values: { en: 'result' } },
                            required: true,
                            minConnections: 0,
                            compatibleValueTypes: [BuilderValueType.RESULT, BuilderValueType.ANY],
                        },
                    ],
                    executionRole: BuilderNodeExecutionRole.AI,
                },
            } as Parameters<typeof buildDefinitionMap>[0][number],
        ]);
        const srcDef = [...defs.entries()].find(([, v]) => v.nodeTypeKey === 'web-scraper')![0];
        const targetDef = [...defs.entries()].find(([, v]) => v.nodeTypeKey === 'structured-ai-generator')![0];

        const flowNodes = [
            { nodeId: 'src', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, builderCategoryKey: 'acquisition', nodeTypeKey: 'web-scraper', required: true },
            { nodeId: 'ai', definitionAssetId: targetDef, nodeKind: NodeKind.AI_PROVIDER, builderCategoryKey: 'reasoning', nodeTypeKey: 'structured-ai-generator', required: true },
        ];
        const flowConnections = [
            {
                connectionId: 'e1',
                source: { nodeId: 'src', portKey: 'payload' },
                target: { nodeId: 'ai', portKey: 'data' },
                required: true,
            },
        ];

        const r = validateDynamicFlowGraph({ flowNodes, flowConnections, definitionByAssetId: defs });
        expect(r.blockingErrors.some(e => e.code === 'incompatible_node_kinds')).toBe(true);
    });

    it('blocks terminal connections when terminalConfig restricts acceptedSourceNodeTypeKeys', () => {
        const defs = buildDefinitionMap([
            {
                _id: new Types.ObjectId(),
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                slug: 'nd-source-web-scraper',
                nodeDefinition: {
                    nodeKind: NodeKind.DATA_SOURCE,
                    category: NodeCategory.SOURCE,
                    builderCategoryKey: 'acquisition',
                    nodeTypeKey: 'web-scraper',
                    inputs: [],
                    outputs: srcOut,
                    executionRole: BuilderNodeExecutionRole.SOURCE,
                },
            } as Parameters<typeof buildDefinitionMap>[0][number],
            {
                _id: new Types.ObjectId(),
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                slug: 'nd-terminal-ai',
                nodeDefinition: {
                    nodeKind: NodeKind.TERMINAL,
                    category: NodeCategory.TERMINAL,
                    builderCategoryKey: 'delivery',
                    nodeTypeKey: 'terminal-ai',
                    inputs: [
                        {
                            key: 'in',
                            direction: NodeConnectionDirection.INPUT,
                            valueType: BuilderValueType.ANY,
                            label: { defaultLanguage: 'en', values: { en: 'in' } },
                            required: true,
                            minConnections: 1,
                            compatibleValueTypes: [BuilderValueType.ANY],
                        },
                    ],
                    outputs: [],
                    executionRole: BuilderNodeExecutionRole.TERMINAL,
                },
            } as Parameters<typeof buildDefinitionMap>[0][number],
        ]);
        const srcDef = [...defs.entries()].find(([, v]) => v.nodeTypeKey === 'web-scraper')![0];
        const terminalDef = [...defs.entries()].find(([, v]) => v.nodeTypeKey === 'terminal-ai')![0];

        const flowNodes = [
            { nodeId: 'src', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, builderCategoryKey: 'acquisition', nodeTypeKey: 'web-scraper', required: true },
            {
                nodeId: 'terminal',
                definitionAssetId: terminalDef,
                nodeKind: NodeKind.TERMINAL,
                builderCategoryKey: 'delivery',
                nodeTypeKey: 'terminal-ai',
                required: true,
                terminalConfig: {
                    terminalKey: 'final',
                    required: true,
                    acceptedSourceKinds: [NodeKind.AI_PROVIDER],
                    acceptedSourceNodeTypeKeys: ['structured-ai-generator'],
                    outputMode: 'aiResult',
                },
            },
        ];
        const flowConnections = [
            {
                connectionId: 'e1',
                source: { nodeId: 'src', portKey: 'payload' },
                target: { nodeId: 'terminal', portKey: 'in' },
                required: true,
            },
        ];

        const r = validateDynamicFlowGraph({ flowNodes, flowConnections, definitionByAssetId: defs });
        expect(r.blockingErrors.some(e => e.code === 'terminal_source_not_accepted')).toBe(true);
    });

    it('allows merger multi-wire when catalog row mis-declares `out` as OBJECT (still sole `in`, no mapper slots)', () => {
        const mergerOutObject = [
            {
                key: 'out',
                direction: NodeConnectionDirection.OUTPUT,
                valueType: BuilderValueType.OBJECT,
                label: { defaultLanguage: 'en', values: { en: 'out' } },
                required: true,
                minConnections: 0,
                compatibleValueTypes: [BuilderValueType.OBJECT, BuilderValueType.ANY],
            },
        ];
        const defs = buildDefinitionMap([
            asset('nd-src', NodeKind.DATA_SOURCE, [], srcOut, BuilderNodeExecutionRole.SOURCE, NodeCategory.SOURCE),
            {
                _id: new Types.ObjectId(),
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                nodeDefinition: {
                    nodeKind: NodeKind.TRANSFORM,
                    category: NodeCategory.TRANSFORM,
                    inputs: mergerInStaleMapperCap,
                    outputs: mergerOutObject,
                    executionRole: BuilderNodeExecutionRole.TRANSFORM,
                },
            } as Parameters<typeof buildDefinitionMap>[0][number],
        ]);
        const srcDef = [...defs.entries()].find(([, v]) => v.nodeKind === NodeKind.DATA_SOURCE)![0];
        const mergerDef = [...defs.entries()].find(([, v]) => v.nodeKind === NodeKind.TRANSFORM)![0];

        const flowNodes = [
            { nodeId: 's1', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, required: true },
            { nodeId: 's2', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, required: true },
            { nodeId: 'mg', definitionAssetId: mergerDef, nodeKind: NodeKind.TRANSFORM, required: true },
        ];
        const flowConnections = [
            { connectionId: 'e1', source: { nodeId: 's1', portKey: 'payload' }, target: { nodeId: 'mg', portKey: 'in' }, required: true },
            { connectionId: 'e2', source: { nodeId: 's2', portKey: 'payload' }, target: { nodeId: 'mg', portKey: 'in' }, required: true },
        ];
        const r = validateDynamicFlowGraph({ flowNodes, flowConnections, definitionByAssetId: defs });
        expect(r.blockingErrors.filter(e => e.code === 'too_many_connections')).toHaveLength(0);
    });

    it('honours definitionSlug from flow when Mongo catalog omits slug (merger identified by palette slug)', () => {
        const defs = buildDefinitionMap([
            asset('nd-src', NodeKind.DATA_SOURCE, [], srcOut, BuilderNodeExecutionRole.SOURCE, NodeCategory.SOURCE),
            {
                _id: new Types.ObjectId(),
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                nodeDefinition: {
                    nodeKind: NodeKind.TRANSFORM,
                    category: NodeCategory.TRANSFORM,
                    inputs: mapperInputsWithSlot,
                    outputs: mergerOut,
                    executionRole: BuilderNodeExecutionRole.TRANSFORM,
                },
            } as Parameters<typeof buildDefinitionMap>[0][number],
        ]);
        const srcDef = [...defs.entries()].find(([, v]) => v.nodeKind === NodeKind.DATA_SOURCE)![0];
        const mergerDef = [...defs.entries()].find(([, v]) => v.nodeKind === NodeKind.TRANSFORM)![0];

        const flowNodes = [
            { nodeId: 's1', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, required: true },
            { nodeId: 's2', definitionAssetId: srcDef, nodeKind: NodeKind.DATA_SOURCE, required: true },
            {
                nodeId: 'mg',
                definitionAssetId: mergerDef,
                nodeKind: NodeKind.TRANSFORM,
                required: true,
                definitionSlug: ND_MERGER_DEFINITION_SLUG,
            },
        ];
        const flowConnections = [
            { connectionId: 'e1', source: { nodeId: 's1', portKey: 'payload' }, target: { nodeId: 'mg', portKey: 'in' }, required: true },
            { connectionId: 'e2', source: { nodeId: 's2', portKey: 'payload' }, target: { nodeId: 'mg', portKey: 'in' }, required: true },
        ];
        const r = validateDynamicFlowGraph({ flowNodes, flowConnections, definitionByAssetId: defs });
        expect(r.blockingErrors.filter(e => e.code === 'too_many_connections')).toHaveLength(0);
    });
});
