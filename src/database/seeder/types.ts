/**
 * Core type definitions for seed data.
 * All seed JSON files conform to these shapes.
 */

export interface LocalizedSeed {
    defaultLanguage: string;
    values: Record<string, string>;
}

export interface BuilderAssetSeed {
    assetType: string;
    slug: string;
    name: LocalizedSeed;
    description?: LocalizedSeed;
    scope: string;
    status: string;
    metadata: Record<string, unknown>;
    nodeDefinition?: Record<string, unknown>;
}

export interface AnalysisCategorySeed {
    key: string;
    slug: string;
    localizedName: LocalizedSeed;
    localizedDescription?: LocalizedSeed;
    icon?: string;
    sortOrder: number;
    status?: string;
    isSystem?: boolean;
}

export interface BuilderCategorySeed {
    key: string;
    slug: string;
    localizedName: LocalizedSeed;
    localizedDescription?: LocalizedSeed;
    icon?: string;
    color?: string;
    sortOrder: number;
    allowedOutgoingCategoryKeys: string[];
    allowedIncomingCategoryKeys?: string[];
    status?: string;
    isSystem?: boolean;
}

export interface NodeTypeSeed {
    key: string;
    slug: string;
    localizedName: LocalizedSeed;
    localizedDescription?: LocalizedSeed;
    builderCategoryKey: string;
    executionFamily: string;
    executorKey: string;
    rendererKey: string;
    capabilities?: string[];
    supportsRetry?: boolean;
    supportsBranching?: boolean;
    supportsMultipleInbound?: boolean;
    supportsMultipleOutbound?: boolean;
    status?: string;
}

export interface NodeDefinitionMetaBackfillSeed {
    slug: string;
    builderCategoryKey: string;
    nodeTypeKey: string;
}

export interface DataSourceSeed {
    name: string;
    provider: string;
    type: string;
    kind: string;
    authType: string;
    isActive: boolean;
}

export interface ReportTypeSeed {
    slug: string;
    name: string;
    description: string;
    localizedName: LocalizedSeed;
    localizedDescription: LocalizedSeed;
    estimatedDuration: number;
    isStandalone: boolean;
    standalonePrice: number;
    isActive: boolean;
}

export interface PlanSeed {
    name: string;
    tier: string;
    price: number;
    billingCycle: string;
    reportLimits: Record<string, number>;
    apiAccessEnabled: boolean;
    maxUsers: number;
    features: string[];
    isActive: boolean;
}

export interface SampleDynamicFlowSeed {
    flowNodes: Array<{
        nodeId: string;
        definitionAssetSlug: string;
        nodeKind: string;
        required: boolean;
        config?: Record<string, unknown>;
        mapperRules?: Array<Record<string, unknown>>;
        terminalConfig?: Record<string, unknown>;
        position?: { x: number; y: number };
    }>;
    flowConnections: Array<{
        connectionId: string;
        source: { nodeId: string; portKey: string };
        target: { nodeId: string; portKey: string };
        required: boolean;
    }>;
}

export interface ReportTypeBuilderSampleSeed {
    reportType: {
        slug: string;
        localizedName: LocalizedSeed;
        localizedDescription: LocalizedSeed;
        estimatedDuration: number;
        isStandalone: boolean;
        standalonePrice: number;
    };
    defaultLanguage: string;
    dynamicFlow: SampleDynamicFlowSeed;
    analysisTypeSlug: string;
}

export interface DynamicReportExampleSeed {
    slug: string;
    name: string;
    nameAr: string;
    description: string;
    descriptionAr: string;
    analysisCategorySlug: string;
    analysisTypeSlug: string;
    estimatedDuration: number;
    isStandalone: boolean;
    standalonePrice: number;
    versionNumber: number;
    publish: boolean;
    defaultLanguage: string;
    dynamicFlow: SampleDynamicFlowSeed;
}
