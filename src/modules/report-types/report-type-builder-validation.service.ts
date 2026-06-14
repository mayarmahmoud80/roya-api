import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';
import { BuilderAssetType } from '../common/enums/builder-asset-type.enum';
import { BuilderCategory, BuilderCategoryDocument } from '../builder-categories/builder-category.schema';
import { buildDefinitionMap, validateDynamicFlowGraph } from './dynamic-flow-graph.validation';
import { FlowValidationResultPayload } from './dynamic-flow-validation.types';

/**
 * Validates the DAG authored in the builder against the active node-definition catalog.
 * The legacy sequential-draft validator (`validateDraft`) was removed with the DAG-only
 * refactor; structural rules now live in {@link validateDynamicFlowGraph}.
 */
@Injectable()
export class ReportTypeBuilderValidationService {
    constructor(@InjectModel(BuilderCategory.name) private readonly builderCategoryModel: Model<BuilderCategoryDocument>) {}

    async validateDynamicReportFlow(
        flowNodes: unknown[] | undefined,
        flowConnections: unknown[] | undefined,
        definitionAssets: Array<{
            _id: unknown;
            assetType: string;
            status: BuilderAssetStatus;
            nodeDefinition?: Record<string, unknown>;
        }>,
    ): Promise<FlowValidationResultPayload> {
        const map = buildDefinitionMap(
            definitionAssets.filter(a => a.assetType === BuilderAssetType.NODE_DEFINITION) as Parameters<typeof buildDefinitionMap>[0],
        );
        const categoryRows = await this.builderCategoryModel.find().lean().exec();
        const categoryPolicy = new Map<string, string[]>();
        for (const row of categoryRows) {
            const outgoing = Array.isArray(row.allowedOutgoingCategoryKeys) ? row.allowedOutgoingCategoryKeys : [];
            categoryPolicy.set(row.key, outgoing);
            categoryPolicy.set(row.slug, outgoing);
        }
        return validateDynamicFlowGraph({
            flowNodes: (flowNodes ?? []) as Parameters<typeof validateDynamicFlowGraph>[0]['flowNodes'],
            flowConnections: (flowConnections ?? []) as Parameters<typeof validateDynamicFlowGraph>[0]['flowConnections'],
            definitionByAssetId: map,
            categoryPolicy,
        });
    }
}
