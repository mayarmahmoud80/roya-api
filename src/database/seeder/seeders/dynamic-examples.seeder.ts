import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReportType, ReportTypeDocument } from '../../../modules/report-types/report-type.schema';
import { ReportTypeVersion, ReportTypeVersionDocument } from '../../../modules/report-types/report-type-version.schema';
import { BuilderAsset, BuilderAssetDocument } from '../../../modules/builder-assets/schemas/builder-asset.schema';
import { AnalysisType, AnalysisTypeDocument } from '../../../modules/analysis-types/analysis-type.schema';
import { AnalysisCategoryEntity, AnalysisCategoryDocument } from '../../../modules/analysis-categories/analysis-category.schema';
import { PublicationStatus } from '../../../modules/common/enums/publication-status.enum';
import { FlowValidationTargetType } from '../../../modules/common/enums/builder-node.enum';
import { buildPublishedFlowSnapshot } from '../../../modules/report-types/report-type-flow-snapshot';
import { buildDynamicExampleFlowFields } from '../helpers/flow-builder';
import { localized } from '../helpers/localized';
import dynamicExamples from '../data/dynamic-report-examples.json';

@Injectable()
export class DynamicExamplesSeeder {
    private readonly logger = new Logger(DynamicExamplesSeeder.name);

    constructor(
        @InjectModel(ReportType.name)
        private readonly reportTypeModel: Model<ReportTypeDocument>,
        @InjectModel(ReportTypeVersion.name)
        private readonly reportTypeVersionModel: Model<ReportTypeVersionDocument>,
        @InjectModel(BuilderAsset.name)
        private readonly builderAssetModel: Model<BuilderAssetDocument>,
        @InjectModel(AnalysisType.name)
        private readonly analysisTypeModel: Model<AnalysisTypeDocument>,
        @InjectModel(AnalysisCategoryEntity.name)
        private readonly analysisCategoryModel: Model<AnalysisCategoryDocument>,
    ) {}

    async seed(): Promise<void> {
        const allAssets = await this.builderAssetModel.find({ status: 'active' }).lean().exec();
        const assetBySlug = new Map<string, Types.ObjectId>(allAssets.map(a => [a.slug, a._id as Types.ObjectId]));
        const resolveAssetId = (slug: string): Types.ObjectId => {
            const id = assetBySlug.get(slug);
            if (!id) throw new Error(`Missing builder asset "${slug}"`);
            return id;
        };
        const analysisTypes = await this.analysisTypeModel.find().exec();
        const analysisTypeBySlug = new Map(analysisTypes.map(row => [row.slug, row]));
        const analysisCategories = await this.analysisCategoryModel.find().lean().exec();
        const analysisCategoryBySlug = new Map(analysisCategories.map(row => [row.slug, row]));

        for (const seed of dynamicExamples) {
            let reportType = await this.reportTypeModel.findOne({ slug: seed.slug }).exec();
            if (!reportType) {
                reportType = await this.reportTypeModel.create({
                    slug: seed.slug,
                    name: seed.name,
                    description: seed.description,
                    localizedName: localized(seed.name, seed.nameAr),
                    localizedDescription: localized(seed.description, seed.descriptionAr),
                    estimatedDuration: seed.estimatedDuration,
                    isStandalone: seed.isStandalone,
                    standalonePrice: seed.standalonePrice,
                    scope: 'global',
                    status: seed.publish ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT,
                });
            }
            if (!reportType) continue;
            const seededReportType = reportType;

            let linkedVersionId = reportType.currentPublishedVersionId as Types.ObjectId | undefined;
            const existingPublished = await this.reportTypeVersionModel
                .findOne({ reportTypeId: reportType._id, versionNumber: seed.versionNumber })
                .exec();
            if (!existingPublished) {
                const { flowNodes, flowConnections } = buildDynamicExampleFlowFields(seed, resolveAssetId);
                const nodeDefinitionDocs = await this.builderAssetModel
                    .find({
                        _id: { $in: flowNodes.map(node => node.definitionAssetId as Types.ObjectId) },
                    })
                    .lean()
                    .exec();
                const validationSummary = {
                    targetType: FlowValidationTargetType.REPORT_FLOW,
                    blockingErrors: [],
                    warnings: [],
                    graphStats: {
                        nodeCount: flowNodes.length,
                        connectionCount: flowConnections.length,
                        terminalPathCount: 1,
                    },
                    checkedAt: new Date(),
                };
                const version = await this.reportTypeVersionModel.create({
                    reportTypeId: reportType._id,
                    versionNumber: seed.versionNumber,
                    status: seed.publish ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT,
                    defaultLanguage: seed.defaultLanguage,
                    flowNodes,
                    flowConnections,
                    flowValidationSummary: validationSummary,
                    ...(seed.publish
                        ? {
                              publishedFlowSnapshot: buildPublishedFlowSnapshot({
                                  defaultLanguage: seed.defaultLanguage,
                                  flowNodes,
                                  flowConnections,
                                  nodeDefinitionDocs: nodeDefinitionDocs as unknown as Array<Record<string, unknown>>,
                                  validationSummary,
                              }),
                          }
                        : {}),
                });

                await this.reportTypeModel
                    .updateOne(
                        { _id: reportType._id },
                        {
                            $set: {
                                status: seed.publish ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT,
                                currentPublishedVersionId: seed.publish ? version._id : undefined,
                                draftVersionId: seed.publish ? undefined : version._id,
                            },
                        },
                    )
                    .exec();
                linkedVersionId = version._id as Types.ObjectId;
            } else if (seed.publish) {
                linkedVersionId = existingPublished._id as Types.ObjectId;
            }

            const analysisType = analysisTypeBySlug.get(seed.analysisTypeSlug);
            const analysisCategory = analysisCategoryBySlug.get(seed.analysisCategorySlug);
            if (analysisType) {
                const currentRefs = analysisType.reportTypes ?? [];
                const exists = currentRefs.some(ref => String(ref.reportTypeId) === String(seededReportType._id));
                if (!exists) {
                    if (!linkedVersionId) {
                        continue;
                    }
                    currentRefs.push({
                        reportTypeId: seededReportType._id as Types.ObjectId,
                        reportTypeVersionId: linkedVersionId,
                        order: currentRefs.length + 1,
                    });
                    analysisType.reportTypes = currentRefs;
                    if (!analysisType.analysisCategoryId && analysisCategory?._id) {
                        analysisType.analysisCategoryId = analysisCategory._id as Types.ObjectId;
                    }
                    await analysisType.save();
                }
            }
        }
        this.logger.log(`Seeded ${dynamicExamples.length} dynamic refactor example report flows`);
    }
}
