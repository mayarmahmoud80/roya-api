import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReportType, ReportTypeDocument } from '../../../modules/report-types/report-type.schema';
import { ReportTypeVersion, ReportTypeVersionDocument } from '../../../modules/report-types/report-type-version.schema';
import { BuilderAsset, BuilderAssetDocument } from '../../../modules/builder-assets/schemas/builder-asset.schema';
import { AnalysisType, AnalysisTypeDocument } from '../../../modules/analysis-types/analysis-type.schema';
import { PublicationStatus } from '../../../modules/common/enums/publication-status.enum';
import { FlowValidationTargetType } from '../../../modules/common/enums/builder-node.enum';
import { buildSampleDynamicFlowFields } from '../helpers/flow-builder';
import sampleFlow from '../data/builder-sample-flow.json';

@Injectable()
export class BuilderSampleFlowSeeder {
    private readonly logger = new Logger(BuilderSampleFlowSeeder.name);

    constructor(
        @InjectModel(ReportType.name)
        private readonly reportTypeModel: Model<ReportTypeDocument>,
        @InjectModel(ReportTypeVersion.name)
        private readonly reportTypeVersionModel: Model<ReportTypeVersionDocument>,
        @InjectModel(BuilderAsset.name)
        private readonly builderAssetModel: Model<BuilderAssetDocument>,
        @InjectModel(AnalysisType.name)
        private readonly analysisTypeModel: Model<AnalysisTypeDocument>,
    ) {}

    async seed(): Promise<void> {
        await this.seedBuilderSampleDraft();
        await this.mergeSampleDynamicFlowIfEmpty();
    }

    private async seedBuilderSampleDraft() {
        const reportType = await this.reportTypeModel.findOne({ slug: sampleFlow.reportType.slug }).exec();
        if (!reportType) {
            this.logger.warn(`seedBuilderSampleDraft: report type '${sampleFlow.reportType.slug}' not found — skipping`);
            return;
        }

        if (reportType.draftVersionId) {
            this.logger.log(`seedBuilderSampleDraft: draft already exists for '${sampleFlow.reportType.slug}' — skipping`);
            return;
        }

        const existingV1 = await this.reportTypeVersionModel
            .findOne({ reportTypeId: reportType._id, versionNumber: 1 })
            .exec();
        if (existingV1) {
            if (existingV1.status === PublicationStatus.DRAFT) {
                await this.reportTypeModel.findByIdAndUpdate(reportType._id, {
                    $set: { draftVersionId: existingV1._id },
                }).exec();
                this.logger.log(
                    `seedBuilderSampleDraft: linked existing v1 draft to report type '${sampleFlow.reportType.slug}' — skipping create`,
                );
            } else {
                this.logger.log(
                    `seedBuilderSampleDraft: version 1 already exists (not draft) for '${sampleFlow.reportType.slug}' — skipping`,
                );
            }
            return;
        }

        const allAssets = await this.builderAssetModel.find({ status: 'active' }).lean().exec();
        const assetBySlug = new Map<string, Types.ObjectId>(
            allAssets.map(a => [a.slug, a._id as Types.ObjectId]),
        );

        const resolveAssetId = (slug: string): Types.ObjectId => {
            const id = assetBySlug.get(slug);
            if (!id) throw new Error(`Builder asset with slug '${slug}' not found`);
            return id;
        };

        try {
            const { flowNodes, flowConnections } = buildSampleDynamicFlowFields(sampleFlow, resolveAssetId);
            const draftVersion = await this.reportTypeVersionModel.create({
                reportTypeId: reportType._id,
                versionNumber: 1,
                status: PublicationStatus.DRAFT,
                defaultLanguage: sampleFlow.defaultLanguage,
                flowNodes,
                flowConnections,
                flowValidationSummary: {
                    targetType: FlowValidationTargetType.REPORT_FLOW,
                    blockingErrors: [],
                    warnings: [],
                    graphStats: {
                        nodeCount: flowNodes.length,
                        connectionCount: flowConnections.length,
                        terminalPathCount: 1,
                    },
                    checkedAt: new Date(),
                },
            });

            await this.reportTypeModel.findByIdAndUpdate(reportType._id, {
                $set: { draftVersionId: draftVersion._id },
            }).exec();

            const analysisType = await this.analysisTypeModel.findOne({ slug: sampleFlow.analysisTypeSlug }).exec();
            if (analysisType) {
                const existingRefs = analysisType.reportTypes ?? [];
                const withoutThis = existingRefs.filter(rt => String(rt.reportTypeId) !== String(reportType._id));
                const nextRefs = [
                    ...withoutThis,
                    {
                        reportTypeId: reportType._id as Types.ObjectId,
                        reportTypeVersionId: draftVersion._id as Types.ObjectId,
                        order: withoutThis.length + 1,
                    },
                ];
                await this.analysisTypeModel.updateOne(
                    { _id: analysisType._id },
                    { $set: { reportTypes: nextRefs } },
                ).exec();
            }

            this.logger.log(`seedBuilderSampleDraft: created draft version for '${sampleFlow.reportType.slug}'`);
        } catch (err) {
            this.logger.error(`seedBuilderSampleDraft: failed — ${(err as Error).message}`);
        }
    }

    private async mergeSampleDynamicFlowIfEmpty() {
        const reportType = await this.reportTypeModel.findOne({ slug: sampleFlow.reportType.slug }).exec();
        if (!reportType?.draftVersionId) {
            return;
        }
        const version = await this.reportTypeVersionModel.findById(reportType.draftVersionId).lean().exec();
        if (!version) {
            return;
        }
        if (Array.isArray(version.flowNodes) && version.flowNodes.length > 0) {
            return;
        }
        const allAssets = await this.builderAssetModel.find({ status: 'active' }).lean().exec();
        const assetBySlug = new Map<string, Types.ObjectId>(allAssets.map(a => [a.slug, a._id as Types.ObjectId]));
        const resolve = (slug: string): Types.ObjectId => {
            const id = assetBySlug.get(slug);
            if (!id) {
                throw new Error(`mergeSampleDynamicFlowIfEmpty: missing builder asset ${slug}`);
            }
            return id;
        };
        try {
            const { flowNodes, flowConnections } = buildSampleDynamicFlowFields(sampleFlow, resolve);
            await this.reportTypeVersionModel
                .updateOne(
                    { _id: reportType.draftVersionId },
                    {
                        $set: {
                            flowNodes,
                            flowConnections,
                            flowValidationSummary: {
                                targetType: FlowValidationTargetType.REPORT_FLOW,
                                blockingErrors: [],
                                warnings: [],
                                graphStats: {
                                    nodeCount: flowNodes.length,
                                    connectionCount: flowConnections.length,
                                    terminalPathCount: 1,
                                },
                                checkedAt: new Date(),
                            },
                        },
                    },
                )
                .exec();
            this.logger.log(`mergeSampleDynamicFlowIfEmpty: attached ${flowNodes.length} flow nodes to '${sampleFlow.reportType.slug}' draft`);
        } catch (err) {
            this.logger.warn(`mergeSampleDynamicFlowIfEmpty: ${(err as Error).message}`);
        }
    }
}
