import { Model } from 'mongoose';
import { ConnectorRegistry } from '../providers/connectors/connector.registry';
import { OpenAIService } from '../clients/openai/openai.service';
import { ConnectionsService } from '../connections/connections.service';
import { DataSourceDocument } from '../data-sources/data-source.schema';
import { ReportTypeDocument } from '../report-types/report-type.schema';
import { ConnectionDocument } from '../connections/schemas/connection.schema';
import { DynamicFlowMapperService } from './dynamic-flow-mapper.service';
import { MapperTransform, NodeCategory, NodeKind } from '../common/enums/builder-node.enum';

export interface SnapshotNode {
    nodeId: string;
    nodeKind: NodeKind | string;
    definitionAssetId?: string;
    category?: NodeCategory;
    builderCategoryKey?: string;
    nodeTypeKey?: string;
    providerKey?: string;
    label?: string;
    name?: string;
    required?: boolean;
    config?: Record<string, unknown>;
    mapperRules?: Array<{
        ruleId?: string;
        targetPath: string;
        sourcePath?: string;
        transform: MapperTransform;
        parameters?: Record<string, unknown>;
        required?: boolean;
    }>;
    terminalConfig?: {
        terminalKey?: string;
        required?: boolean;
        outputMode?: string;
        acceptedSourceKinds?: string[];
        acceptedSourceNodeTypeKeys?: string[];
    };
}

export interface SnapshotConnection {
    connectionId: string;
    source: { nodeId: string; portKey: string };
    target: { nodeId: string; portKey: string };
    required?: boolean;
}

export interface NodeRuntime {
    status: 'completed' | 'failed' | 'skipped';
    outputs: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
}

export interface NodeExecutionHelpers {
    connectorRegistry: ConnectorRegistry;
    openaiService: OpenAIService;
    connectionsService: ConnectionsService;
    mapper: DynamicFlowMapperService;
    dataSourceModel: Model<DataSourceDocument>;
}

export interface NodeExecutionContext {
    node: SnapshotNode;
    incoming: SnapshotConnection[];
    runtime: Map<string, NodeRuntime>;
    incomingByPort: Record<string, unknown[]>;
    inputs: Record<string, unknown>;
    reportType: ReportTypeDocument;
    connectionByProviderSlug: Map<string, ConnectionDocument>;
    openaiKey?: string;
    openaiModel?: string;
    definitionByAssetId: Map<string, Record<string, unknown>>;
    helpers: NodeExecutionHelpers;
}

export interface DynamicNodeExecutor {
    supports(ctx: NodeExecutionContext): boolean;
    execute(ctx: NodeExecutionContext): Promise<Record<string, unknown>>;
}
