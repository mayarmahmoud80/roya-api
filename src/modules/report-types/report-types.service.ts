import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReportType, ReportTypeDocument } from './report-type.schema';
import { ReportTypeVersion, ReportTypeVersionDocument } from './report-type-version.schema';
import { BuilderAsset, BuilderAssetDocument } from '../builder-assets/schemas/builder-asset.schema';
import { BuilderCategory, BuilderCategoryDocument } from '../builder-categories/builder-category.schema';
import { DataSource, DataSourceDocument } from '../data-sources/data-source.schema';
import { AnalysisType, AnalysisTypeDocument } from '../analysis-types/analysis-type.schema';
import { NodeType, NodeTypeDocument } from '../node-types/node-type.schema';
import { ReportTypeBuilderValidationService } from './report-type-builder-validation.service';
import { CreateReportTypeDto } from './dto/create-report-type.dto';
import { ReportFlowDraftInputDto } from './dto/dynamic-flow.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PublicationStatus } from '../common/enums/publication-status.enum';
import { AssetScope } from '../common/enums/asset-scope.enum';
import { BuilderAssetType } from '../common/enums/builder-asset-type.enum';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';
import { NodeCategory, NodeKind } from '../common/enums/builder-node.enum';
import { resolveCategory } from '../common/node-category-rules';
import { BUILDER_DATA_SOURCE_SLUG_TO_PROVIDER } from '../common/builder-data-source-providers';
import { buildPublishedFlowSnapshot } from './report-type-flow-snapshot';
import { FlowValidationResultPayload } from './dynamic-flow-validation.types';
import { nodeDefinitionFromAsset } from './dynamic-flow-graph.validation';

/** Reference kinds still discoverable once the pre-DAG fields were removed. */
export interface ReportTypeBuilderAssetReference {
    kind: 'nodeDefinition';
    path: string;
}

export interface ReportTypeBuilderAssetUsage {
    reportTypeId: Types.ObjectId;
    reportTypeSlug?: string;
    reportTypeName?: unknown;
    versionId: Types.ObjectId;
    versionNumber: number;
    versionStatus: PublicationStatus;
    references: ReportTypeBuilderAssetReference[];
}

type PlainReportType = Record<string, unknown>;

type DerivedLegacyShape = {
    /** Portal `inputSchema` reconstructed from INPUT_FIELD snapshot nodes. */
    inputSchema: Record<string, unknown>;
    /** Portal `outputSchema` reconstructed from the flow's SCHEMA node configuration. */
    outputSchema: Record<string, string>;
    /** `DataSource._id` values referenced by SOURCE nodes (for billing / capacity checks). */
    dataSourceIds: Types.ObjectId[];
    /** Reverse lookup of the analysis type that attached this report type. */
    analysisTypeId?: Types.ObjectId;
};

/**
 * Service facade for {@link ReportType}. After the DAG-only refactor the schema stores
 * only identity and version pointers; all structure lives on the version's
 * {@link ReportTypeVersion.publishedFlowSnapshot}. For backward compatibility with
 * existing portal pages that read `inputSchema` / `outputSchema` / `dataSourceIds` /
 * `analysisTypeId`, this service derives an equivalent read-shape on every read and
 * attaches it to the returned payload (never persisted).
 */
@Injectable()
export class ReportTypesService {
    private readonly logger = new Logger(ReportTypesService.name);

    constructor(
        @InjectModel(ReportType.name) private readonly model: Model<ReportTypeDocument>,
        @InjectModel(ReportTypeVersion.name) private readonly versionModel: Model<ReportTypeVersionDocument>,
        @InjectModel(BuilderAsset.name) private readonly builderAssetModel: Model<BuilderAssetDocument>,
        @InjectModel(BuilderCategory.name) private readonly builderCategoryModel: Model<BuilderCategoryDocument>,
        @InjectModel(NodeType.name) private readonly nodeTypeModel: Model<NodeTypeDocument>,
        @InjectModel(DataSource.name) private readonly dataSourceModel: Model<DataSourceDocument>,
        @InjectModel(AnalysisType.name) private readonly analysisTypeModel: Model<AnalysisTypeDocument>,
        private readonly validation: ReportTypeBuilderValidationService,
    ) {}

    async findAll(query: PaginationQueryDto = new PaginationQueryDto()) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 25;
        const filter: Record<string, unknown> = {};
        if (query.status) {
            filter.status = query.status;
        }
        if (query.search) {
            filter.$or = [
                { slug: new RegExp(query.search, 'i') },
                { name: new RegExp(query.search, 'i') },
                { 'localizedName.values.en': new RegExp(query.search, 'i') },
                { 'localizedName.values.ar': new RegExp(query.search, 'i') },
            ];
        }

        const [items, total] = await Promise.all([
            this.model
                .find(filter)
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
                .exec(),
            this.model.countDocuments(filter).exec(),
        ]);

        const enriched = await this.attachDerivedLegacyFields(items as PlainReportType[]);
        return { items: enriched, total, page, limit };
    }

    /**
     * Minimal list of published report types for admin pickers (selects, attach flows).
     * Avoids derived legacy fields and full document hydration.
     */
    async findPublishedLiteList() {
        const raw = await this.model
            .find({ status: PublicationStatus.PUBLISHED })
            .select({ _id: 1, slug: 1, name: 1, localizedName: 1, currentPublishedVersionId: 1 })
            .lean()
            .exec();

        const rows = (raw as PlainReportType[]).map(doc => {
            const id = String((doc as { _id: unknown })._id);
            const slug = String((doc as { slug?: string }).slug ?? '');
            const name = this.resolveReportTypeName(doc as Record<string, unknown>, slug);
            const cpv = (doc as { currentPublishedVersionId?: Types.ObjectId }).currentPublishedVersionId;
            return {
                id,
                slug,
                name,
                currentPublishedVersionId: cpv ? String(cpv) : null,
            };
        });

        return rows.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Lite list for the builder UI with only essential fields.
     */
    async findBuilderLiteList(query: PaginationQueryDto = new PaginationQueryDto()) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 100;
        const filter: Record<string, unknown> = {};

        if (query.status) {
            filter.status = query.status;
        }
        if (query.search) {
            filter.$or = [
                { slug: new RegExp(query.search, 'i') },
                { name: new RegExp(query.search, 'i') },
                { 'localizedName.values.en': new RegExp(query.search, 'i') },
                { 'localizedName.values.ar': new RegExp(query.search, 'i') },
            ];
        }

        const [items, total] = await Promise.all([
            this.model
                .find(filter)
                .select({
                    _id: 1,
                    name: 1,
                    localizedName: 1,
                    slug: 1,
                    status: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    currentPublishedVersionId: 1,
                    draftVersionId: 1,
                })
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
                .exec(),
            this.model.countDocuments(filter).exec(),
        ]);

        const mapped = (items as PlainReportType[]).map((rt) => {
            const id = String((rt as { _id: unknown })._id);
            const slug = String(rt.slug ?? '');
            const name = this.resolveReportTypeName(rt as Record<string, unknown>, slug);
            const cpv = (rt as { currentPublishedVersionId?: Types.ObjectId }).currentPublishedVersionId;
            const dvi = (rt as { draftVersionId?: Types.ObjectId }).draftVersionId;
            return {
                id,
                name,
                slug,
                status: rt.status,
                createdAt: rt.createdAt,
                updatedAt: rt.updatedAt,
                currentPublishedVersionId: cpv ? String(cpv) : null,
                draftVersionId: dvi ? String(dvi) : null,
            };
        });

        return { items: mapped, total, page, limit };
    }

    private resolveReportTypeDisplayName(localizedName: unknown, slug: string): string {
        const fromLoc = this.resolveLocalizedTextBody(localizedName);
        return fromLoc || slug;
    }

    /** Plain `name` field wins; else first non-empty localized value; else slug. */
    private resolveReportTypeName(item: Record<string, unknown>, slug: string): string {
        const n = item['name'];
        if (typeof n === 'string' && n.trim()) return n.trim();
        return this.resolveReportTypeDisplayName(item['localizedName'], slug);
    }

    private resolveReportTypeDescription(item: Record<string, unknown>): string {
        const d = item['description'];
        if (typeof d === 'string' && d.trim()) return d.trim();
        return this.resolveLocalizedTextBody(item['localizedDescription']);
    }

    private resolveLocalizedTextBody(localized: unknown): string {
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
        return '';
    }

    async findById(id: string) {
        const item = await this.model.findById(id).lean().exec();
        if (!item) throw new NotFoundException('Report type not found');
        const [enriched] = await this.attachDerivedLegacyFields([item as PlainReportType]);
        return enriched;
    }

    async findBySlug(slug: string) {
        const item = await this.model.findOne({ slug }).lean().exec();
        if (!item) throw new NotFoundException('Report type not found');
        const [enriched] = await this.attachDerivedLegacyFields([item as PlainReportType]);
        return enriched;
    }

    async findByIds(ids: string[]) {
        return this.model.find({ _id: { $in: ids } }).exec();
    }

    /**
     * Finds usages of a builder node definition across report type versions. Legacy
     * `inputFields`/`dataSources`/`outputSections`/`aiMapping` references were removed;
     * this now only scans draft `flowNodes` and any `publishedFlowSnapshot` copies.
     */
    async findUsageByBuilderAssetId(assetId: string): Promise<ReportTypeBuilderAssetUsage[]> {
        const objectId = new Types.ObjectId(assetId);
        const versions = await this.versionModel
            .find({
                $or: [
                    { 'flowNodes.definitionAssetId': objectId },
                    { 'publishedFlowSnapshot.nodeDefinitions._id': objectId },
                    { 'publishedFlowSnapshot.nodes.definitionAssetId': objectId },
                ],
            })
            .select('_id reportTypeId versionNumber status flowNodes publishedFlowSnapshot')
            .lean()
            .exec();

        const reportTypeIds = [...new Set(versions.map(v => String(v.reportTypeId)))].map(id => new Types.ObjectId(id));
        const reportTypes = await this.model
            .find({ _id: { $in: reportTypeIds } })
            .select('_id slug localizedName status')
            .lean()
            .exec();
        const reportTypeById = new Map(reportTypes.map(rt => [String(rt._id), rt]));

        return versions
            .map(version => {
                const reportType = reportTypeById.get(String(version.reportTypeId));
                return {
                    reportTypeId: version.reportTypeId as Types.ObjectId,
                    reportTypeSlug: reportType?.slug,
                    reportTypeName: reportType?.localizedName,
                    versionId: version._id as Types.ObjectId,
                    versionNumber: version.versionNumber,
                    versionStatus: version.status,
                    references: this.extractNodeDefinitionReferences(version as Record<string, unknown>, objectId),
                };
            })
            .filter(usage => usage.references.length > 0);
    }

    async create(dto: CreateReportTypeDto) {
        const name =
            dto.name?.trim() ||
            this.resolveReportTypeDisplayName(dto.localizedName as unknown, dto.slug);
        const description =
            dto.description?.trim() ||
            this.resolveLocalizedTextBody(dto.localizedDescription as unknown) ||
            undefined;
        const created = await this.model.create({
            ...dto,
            name,
            ...(description !== undefined ? { description } : {}),
            status: PublicationStatus.DRAFT,
        });

        const draft = await this.versionModel.create({
            reportTypeId: created._id,
            versionNumber: 1,
            status: PublicationStatus.DRAFT,
            defaultLanguage: 'en',
            flowNodes: [],
            flowConnections: [],
        });

        created.draftVersionId = draft._id as Types.ObjectId;
        await created.save();
        return created;
    }

    async update(id: string, dto: Partial<CreateReportTypeDto>) {
        const item = await this.model.findByIdAndUpdate(id, { $set: dto }, { new: true }).exec();
        if (!item) throw new NotFoundException('Report type not found');
        return item;
    }

    async getReportFlow(reportTypeId: string) {
        const reportType = await this.model.findById(reportTypeId).lean().exec();
        if (!reportType) {
            throw new NotFoundException('Report type not found');
        }
        const availableNodeDefinitions = this.mapNodeDefinitions(
            await this.listActiveNodeDefinitionsForReportType(reportType),
        );
        const builderTaxonomy = await this.getBuilderTaxonomy();

        const versionId = reportType.draftVersionId ?? reportType.currentPublishedVersionId;
        if (!versionId) {
            return {
                flowNodes: [],
                flowConnections: [],
                validationSummary: undefined,
                availableNodeDefinitions,
                ...builderTaxonomy,
            };
        }
        const version = await this.versionModel.findById(versionId).lean().exec();
        if (!version) {
            throw new NotFoundException('Report type version not found');
        }
        const normalizedFlowNodes = await this.normalizeFlowNodes(version.flowNodes ?? []);
        return {
            flowNodes: normalizedFlowNodes,
            flowConnections: version.flowConnections ?? [],
            validationSummary: version.flowValidationSummary,
            availableNodeDefinitions,
            ...builderTaxonomy,
        };
    }

    async saveReportFlow(reportTypeId: string, dto: ReportFlowDraftInputDto) {
        const reportType = await this.model.findById(reportTypeId).exec();
        if (!reportType) {
            throw new NotFoundException('Report type not found');
        }
        let draftId = reportType.draftVersionId;
        if (!draftId && reportType.currentPublishedVersionId) {
            const published = await this.versionModel.findById(reportType.currentPublishedVersionId).lean().exec();
            const latestVersion = await this.versionModel.countDocuments({ reportTypeId: reportType._id }).exec();
            const draft = await this.versionModel.create({
                ...published,
                _id: undefined,
                reportTypeId: reportType._id,
                versionNumber: latestVersion + 1,
                status: PublicationStatus.DRAFT,
                flowNodes: dto.flowNodes,
                flowConnections: dto.flowConnections,
            });
            draftId = draft._id as Types.ObjectId;
            reportType.draftVersionId = draftId;
            await reportType.save();
        }
        const defDocs = await this.loadNodeDefinitionsForFlow(dto.flowNodes);
        const normalizedFlowNodes = this.normalizeFlowNodesWithDefinitions(dto.flowNodes, defDocs);
        const flowValidation = await this.validation.validateDynamicReportFlow(
            normalizedFlowNodes,
            dto.flowConnections,
            defDocs as unknown as Parameters<typeof this.validation.validateDynamicReportFlow>[2],
        );
        if (!draftId) {
            const created = await this.versionModel.create({
                reportTypeId: reportType._id,
                versionNumber: 1,
                status: PublicationStatus.DRAFT,
                defaultLanguage: 'en',
                flowNodes: normalizedFlowNodes,
                flowConnections: dto.flowConnections,
                flowValidationSummary: flowValidation,
            });
            reportType.draftVersionId = created._id as Types.ObjectId;
            await reportType.save();
            return this.getReportFlow(reportTypeId);
        }
        await this.versionModel
            .findByIdAndUpdate(draftId, {
                $set: {
                    flowNodes: normalizedFlowNodes,
                    flowConnections: dto.flowConnections,
                    flowValidationSummary: flowValidation,
                },
            })
            .exec();
        return this.getReportFlow(reportTypeId);
    }

    async validateReportFlow(reportTypeId: string, dto?: ReportFlowDraftInputDto) {
        const reportType = await this.model.findById(reportTypeId).lean().exec();
        if (!reportType) {
            throw new NotFoundException('Report type not found');
        }
        const versionId = reportType.draftVersionId ?? reportType.currentPublishedVersionId;
        if (!versionId) {
            throw new NotFoundException('Report type version not found');
        }
        const version = await this.versionModel.findById(versionId).lean().exec();
        if (!version) {
            throw new NotFoundException('Report type version not found');
        }
        const nodes = dto?.flowNodes ?? version.flowNodes ?? [];
        const conns = dto?.flowConnections ?? version.flowConnections ?? [];
        const defDocs = await this.loadNodeDefinitionsForFlow(nodes);
        const normalizedFlowNodes = this.normalizeFlowNodesWithDefinitions(nodes, defDocs);
        return this.validation.validateDynamicReportFlow(
            normalizedFlowNodes,
            conns,
            defDocs as unknown as Parameters<typeof this.validation.validateDynamicReportFlow>[2],
        );
    }

    async publish(id: string) {
        const reportType = await this.model.findById(id).exec();
        if (!reportType) throw new NotFoundException('Report type not found');
        if (!reportType.draftVersionId) {
            throw new BadRequestException('No draft to publish. Save your work with Save Draft first, then try again.');
        }
        const draft = await this.versionModel.findById(reportType.draftVersionId).exec();
        if (!draft) throw new NotFoundException('Report type draft not found');

        const hasFlow = Array.isArray(draft.flowNodes) && draft.flowNodes.length > 0;
        if (!hasFlow) {
            throw new UnprocessableEntityException({
                blockingErrors: [
                    {
                        code: 'empty_flow',
                        path: 'flowNodes',
                        message: { defaultLanguage: 'en', values: { en: 'Cannot publish an empty flow.' } },
                        severity: 'error',
                    },
                ],
                warnings: [],
                checkedAt: new Date(),
            });
        }

        const defDocs = await this.loadNodeDefinitionsForFlow(draft.flowNodes);
        const flowValidation: FlowValidationResultPayload = await this.validation.validateDynamicReportFlow(
            draft.flowNodes,
            draft.flowConnections,
            defDocs as unknown as Parameters<typeof this.validation.validateDynamicReportFlow>[2],
        );
        if (flowValidation.blockingErrors.length > 0) {
            throw new UnprocessableEntityException(flowValidation);
        }

        draft.status = PublicationStatus.PUBLISHED;
        draft.publishedFlowSnapshot = buildPublishedFlowSnapshot({
            defaultLanguage: draft.defaultLanguage,
            flowNodes: draft.flowNodes ?? [],
            flowConnections: draft.flowConnections ?? [],
            nodeDefinitionDocs: defDocs as unknown as Array<Record<string, unknown>>,
            validationSummary: flowValidation,
        });
        draft.markModified('publishedFlowSnapshot');
        await draft.save();

        reportType.status = PublicationStatus.PUBLISHED;
        reportType.currentPublishedVersionId = draft._id as Types.ObjectId;
        reportType.draftVersionId = undefined;
        await reportType.save();
        this.logger.log({ event: 'report_type_published', reportTypeId: String(reportType._id), versionId: String(draft._id) });
        const [enriched] = await this.attachDerivedLegacyFields([reportType.toObject({ flattenMaps: true }) as unknown as PlainReportType]);
        return enriched;
    }

    async archive(id: string) {
        const reportType = await this.model.findById(id).exec();
        if (!reportType) throw new NotFoundException('Report type not found');

        reportType.status = PublicationStatus.ARCHIVED;
        await reportType.save();
        if (reportType.currentPublishedVersionId) {
            await this.versionModel.findByIdAndUpdate(reportType.currentPublishedVersionId, { $set: { status: PublicationStatus.ARCHIVED } }).exec();
        }
        this.logger.log({ event: 'report_type_archived', reportTypeId: String(reportType._id) });
        return reportType;
    }

    async rename(id: string, name: string, description?: string) {
        const trimmedName = name.trim();
        if (!trimmedName) throw new BadRequestException('Name cannot be empty');

        const update: Record<string, unknown> = { name: trimmedName };
        if (description !== undefined) {
            update.description = description.trim() || undefined;
        }

        const reportType = await this.model
            .findByIdAndUpdate(id, { $set: update }, { new: true })
            .exec();
        if (!reportType) throw new NotFoundException('Report type not found');
        return reportType;
    }

    async duplicate(id: string) {
        const source = await this.model.findById(id).lean().exec();
        if (!source) throw new NotFoundException('Report type not found');

        const baseName = this.resolveReportTypeName(source as Record<string, unknown>, String(source.slug));
        const copyName = `${baseName} (copy)`;
        let copySlug = `${source.slug}-copy`;

        let slugSuffix = 1;
        while (await this.model.findOne({ slug: copySlug }).lean().exec()) {
            slugSuffix++;
            copySlug = `${source.slug}-copy-${slugSuffix}`;
        }

        const duplicateValues = (localized: unknown): Record<string, unknown> | undefined => {
            if (!localized || typeof localized !== 'object') return undefined;
            const cast = localized as { defaultLanguage?: string; values?: Record<string, string> };
            if (!cast.values) return undefined;
            const newValues: Record<string, string> = {};
            for (const [lang, text] of Object.entries(cast.values)) {
                newValues[lang] = `${text} (copy)`;
            }
            return { defaultLanguage: cast.defaultLanguage ?? 'en', values: newValues };
        };

        const created = await this.model.create({
            name: copyName,
            description: source.description,
            localizedName: duplicateValues(source.localizedName) ?? source.localizedName,
            localizedDescription: source.localizedDescription,
            slug: copySlug,
            scope: source.scope,
            organizationId: source.organizationId,
            status: PublicationStatus.DRAFT,
            isStandalone: source.isStandalone,
            standalonePrice: source.standalonePrice,
            estimatedDuration: source.estimatedDuration,
        });

        if (source.draftVersionId) {
            const sourceVersion = await this.versionModel.findById(source.draftVersionId).lean().exec();
            if (sourceVersion) {
                const draft = await this.versionModel.create({
                    reportTypeId: created._id,
                    versionNumber: 1,
                    status: PublicationStatus.DRAFT,
                    defaultLanguage: sourceVersion.defaultLanguage ?? 'en',
                    flowNodes: sourceVersion.flowNodes ?? [],
                    flowConnections: sourceVersion.flowConnections ?? [],
                });
                created.draftVersionId = draft._id as Types.ObjectId;
                await created.save();
            }
        } else if (source.currentPublishedVersionId) {
            const sourceVersion = await this.versionModel
                .findById(source.currentPublishedVersionId)
                .lean()
                .exec();
            if (sourceVersion) {
                const draft = await this.versionModel.create({
                    reportTypeId: created._id,
                    versionNumber: 1,
                    status: PublicationStatus.DRAFT,
                    defaultLanguage: sourceVersion.defaultLanguage ?? 'en',
                    flowNodes: sourceVersion.flowNodes ?? [],
                    flowConnections: sourceVersion.flowConnections ?? [],
                });
                created.draftVersionId = draft._id as Types.ObjectId;
                await created.save();
            }
        }

        this.logger.log({
            event: 'report_type_duplicated',
            sourceId: String(source._id),
            duplicateId: String(created._id),
        });
        return created;
    }

    async remove(id: string) {
        const reportType = await this.model.findById(id).lean().exec();
        if (!reportType) throw new NotFoundException('Report type not found');

        const usageInAnalyses = await this.analysisTypeModel
            .countDocuments({ 'reportTypes.reportTypeId': new Types.ObjectId(id) })
            .exec();
        if (usageInAnalyses > 0) {
            throw new ConflictException(
                `Cannot delete: ${usageInAnalyses} analysis type(s) reference this report type`,
            );
        }

        await this.versionModel.deleteMany({ reportTypeId: new Types.ObjectId(id) }).exec();
        await this.model.findByIdAndDelete(id).exec();

        this.logger.log({ event: 'report_type_deleted', reportTypeId: id });
        return { deleted: true };
    }

    private async listActiveNodeDefinitionsForReportType(reportType: { scope?: string; organizationId?: Types.ObjectId }): Promise<Record<string, unknown>[]> {
        const or: Record<string, unknown>[] = [{ scope: AssetScope.GLOBAL }];
        if (reportType.organizationId) {
            or.push({ scope: AssetScope.ORGANIZATION, organizationId: reportType.organizationId });
        }
        return this.builderAssetModel
            .find({
                assetType: BuilderAssetType.NODE_DEFINITION,
                status: BuilderAssetStatus.ACTIVE,
                $or: or,
            })
            .sort({ slug: 1 })
            .lean()
            .exec() as Promise<Record<string, unknown>[]>;
    }

    private async getBuilderTaxonomy(): Promise<{
        availableBuilderCategories: Record<string, unknown>[];
        availableNodeTypes: Record<string, unknown>[];
    }> {
        const [builderCategories, nodeTypes] = await Promise.all([
            this.builderCategoryModel.find({ status: BuilderAssetStatus.ACTIVE }).sort({ sortOrder: 1, slug: 1 }).lean().exec(),
            this.nodeTypeModel.find({ status: BuilderAssetStatus.ACTIVE }).sort({ builderCategoryKey: 1, slug: 1 }).lean().exec(),
        ]);
        return {
            availableBuilderCategories: builderCategories as Record<string, unknown>[],
            availableNodeTypes: nodeTypes as Record<string, unknown>[],
        };
    }

    private mapNodeDefinitions(docs: Record<string, unknown>[]): Array<Record<string, unknown>> {
        return docs.map(doc => {
            const nd = (doc['nodeDefinition'] ?? {}) as Record<string, unknown>;
            return {
                _id: String(doc['_id']),
                ...nd,
                name: doc['name'],
                slug: doc['slug'],
                description: doc['description'],
                scope: doc['scope'],
                organizationId: doc['organizationId'],
                status: doc['status'],
            };
        });
    }

    private async loadNodeDefinitionsForFlow(flowNodes: Array<unknown>): Promise<Array<Record<string, unknown>>> {
        const ids = [
            ...new Set(
                (flowNodes ?? [])
                    .map(n => String((n as { definitionAssetId?: unknown } | null)?.definitionAssetId ?? ''))
                    .filter(Boolean),
            ),
        ].map(i => new Types.ObjectId(i));
        if (ids.length === 0) return [];
        return this.builderAssetModel
            .find({ _id: { $in: ids }, assetType: BuilderAssetType.NODE_DEFINITION })
            .lean()
            .exec() as Promise<Array<Record<string, unknown>>>;
    }

    private async normalizeFlowNodes(flowNodes: Array<unknown>): Promise<Array<Record<string, unknown>>> {
        const defDocs = await this.loadNodeDefinitionsForFlow(flowNodes);
        return this.normalizeFlowNodesWithDefinitions(flowNodes, defDocs);
    }

    private normalizeFlowNodesWithDefinitions(
        flowNodes: Array<unknown>,
        defDocs: Array<Record<string, unknown>>,
    ): Array<Record<string, unknown>> {
        const definitionByAssetId = new Map<string, ReturnType<typeof nodeDefinitionFromAsset>>();
        for (const doc of defDocs) {
            const def = nodeDefinitionFromAsset(doc as never);
            if (def) {
                definitionByAssetId.set(def.assetId, def);
            }
        }

        return (flowNodes ?? []).map(node => {
            const rec = (node ?? {}) as Record<string, unknown>;
            const def = definitionByAssetId.get(String(rec['definitionAssetId'] ?? ''));
            if (!def) {
                return { ...rec };
            }
            const wireNodeKind = String(rec['nodeKind']);
            const normalizedNodeKind =
                wireNodeKind === 'mapper' || wireNodeKind === 'merger'
                    ? NodeKind.TRANSFORM
                    : ((rec['nodeKind'] as NodeKind | undefined) ?? def.nodeKind);

            return {
                ...rec,
                nodeKind: normalizedNodeKind,
                category: (rec['category'] as NodeCategory | undefined) ?? def.category,
                builderCategoryKey: (rec['builderCategoryKey'] as string | undefined) ?? def.builderCategoryKey,
                ...(def.nodeTypeKey
                    ? { nodeTypeKey: (rec['nodeTypeKey'] as string | undefined) ?? def.nodeTypeKey }
                    : {}),
            };
        });
    }

    /**
     * For each report type, batch-build the legacy read-shape (`inputSchema`, `outputSchema`,
     * `dataSourceIds`, `analysisTypeId`) from its currently published flow snapshot and the
     * AnalysisType reverse lookup. Nothing is persisted; the shape is attached to the
     * returned payload so portal pages keep working without a frontend migration.
     */
    private async attachDerivedLegacyFields(items: PlainReportType[]): Promise<PlainReportType[]> {
        if (items.length === 0) return items;

        const publishedVersionIds = items
            .map(r => r['currentPublishedVersionId'])
            .filter((v): v is Types.ObjectId | string => !!v)
            .map(v => new Types.ObjectId(String(v)));
        const versionById = new Map<string, Record<string, unknown>>();
        if (publishedVersionIds.length > 0) {
            const versions = await this.versionModel
                .find({ _id: { $in: publishedVersionIds } })
                .select('_id publishedFlowSnapshot defaultLanguage')
                .lean()
                .exec();
            for (const v of versions) {
                versionById.set(String(v._id), v as Record<string, unknown>);
            }
        }

        // Collect provider slugs actually used so we can batch-resolve DataSource ids.
        const providerSlugs = new Set<string>();
        const derivedByItem = new Map<string, DerivedLegacyShape>();

        for (const item of items) {
            const versionId = item['currentPublishedVersionId'];
            const version = versionId ? versionById.get(String(versionId)) : undefined;
            const snap = version?.['publishedFlowSnapshot'] as Record<string, unknown> | undefined;
            const versionLang = (version?.['defaultLanguage'] as string | undefined) ?? 'en';
            const derived: DerivedLegacyShape = {
                inputSchema: {},
                outputSchema: {},
                dataSourceIds: [],
            };
            if (snap) {
                const nodes = (snap['nodes'] as Array<Record<string, unknown>>) ?? [];
                const defs = (snap['nodeDefinitions'] as Array<Record<string, unknown>>) ?? [];
                const defById = new Map(defs.map(d => [String(d['_id']), d]));
                for (const node of nodes) {
                    const category = resolveCategory(
                        node['category'] as NodeCategory | undefined,
                        node['nodeKind'] as NodeKind | undefined,
                    );
                    const cfg = (node['config'] ?? {}) as Record<string, unknown>;
                    if (category === NodeCategory.INPUT) {
                        const key = (cfg['inputKey'] as string | undefined) ?? String(node['nodeId'] ?? '');
                        if (key) {
                            derived.inputSchema[key] = this.inputEntryFromInputNode(cfg, versionLang, key);
                        }
                    } else if (category === NodeCategory.SCHEMA) {
                        const cfgSchema = (cfg['outputSchema'] as Record<string, string> | undefined) ?? {};
                        for (const [k, v] of Object.entries(cfgSchema)) {
                            derived.outputSchema[k] = typeof v === 'string' ? v : 'string';
                        }
                    } else if (category === NodeCategory.SOURCE) {
                        const providerKey = (node['providerKey'] as string | undefined)
                            ?? (defById.get(String(node['definitionAssetId']))?.['nodeDefinition'] as Record<string, unknown> | undefined)?.['providerKey'] as string | undefined;
                        const slugFromKey = providerKey?.split(':')[0];
                        if (slugFromKey) providerSlugs.add(slugFromKey);
                        const legacySlug = (cfg['dataSourceSlug'] as string | undefined);
                        if (legacySlug && BUILDER_DATA_SOURCE_SLUG_TO_PROVIDER[legacySlug]) {
                            providerSlugs.add(BUILDER_DATA_SOURCE_SLUG_TO_PROVIDER[legacySlug]);
                        }
                    }
                }
            }
            derivedByItem.set(String(item['_id']), derived);
        }

        if (providerSlugs.size > 0) {
            const dsDocs = await this.dataSourceModel
                .find({ provider: { $in: [...providerSlugs] } })
                .select('_id provider')
                .lean()
                .exec();
            const idByProvider = new Map(dsDocs.map(d => [d.provider, d._id as Types.ObjectId]));
            for (const item of items) {
                const derived = derivedByItem.get(String(item['_id']))!;
                const seen = new Set<string>();
                const versionId = item['currentPublishedVersionId'];
                const version = versionId ? versionById.get(String(versionId)) : undefined;
                const snap = version?.['publishedFlowSnapshot'] as Record<string, unknown> | undefined;
                const nodes = (snap?.['nodes'] as Array<Record<string, unknown>>) ?? [];
                const defs = (snap?.['nodeDefinitions'] as Array<Record<string, unknown>>) ?? [];
                const defById = new Map(defs.map(d => [String(d['_id']), d]));
                for (const node of nodes) {
                    if (resolveCategory(node['category'] as NodeCategory | undefined, node['nodeKind'] as NodeKind | undefined) !== NodeCategory.SOURCE) continue;
                    const providerKey = (node['providerKey'] as string | undefined)
                        ?? (defById.get(String(node['definitionAssetId']))?.['nodeDefinition'] as Record<string, unknown> | undefined)?.['providerKey'] as string | undefined;
                    const provider = providerKey?.split(':')[0]
                        ?? BUILDER_DATA_SOURCE_SLUG_TO_PROVIDER[((node['config'] as Record<string, unknown> | undefined)?.['dataSourceSlug'] as string | undefined) ?? ''];
                    if (!provider) continue;
                    const id = idByProvider.get(provider);
                    if (id && !seen.has(String(id))) {
                        seen.add(String(id));
                        derived.dataSourceIds.push(id);
                    }
                }
            }
        }

        // Reverse-lookup analysisTypeId once per batch.
        const allReportTypeIds = items.map(i => new Types.ObjectId(String(i['_id'])));
        const analysisTypes = await this.analysisTypeModel
            .find({ 'reportTypes.reportTypeId': { $in: allReportTypeIds } })
            .select('_id reportTypes')
            .lean()
            .exec();
        const analysisTypeByReportTypeId = new Map<string, Types.ObjectId>();
        for (const at of analysisTypes) {
            for (const ref of at.reportTypes ?? []) {
                const key = String(ref.reportTypeId);
                if (!analysisTypeByReportTypeId.has(key)) {
                    analysisTypeByReportTypeId.set(key, at._id as Types.ObjectId);
                }
            }
        }

        return items.map(item => {
            const derived = derivedByItem.get(String(item['_id']))!;
            const analysisTypeId = analysisTypeByReportTypeId.get(String(item['_id']));
            const slug = String(item['slug'] ?? '');
            const displayName = this.resolveReportTypeName(item as Record<string, unknown>, slug);
            const displayDescription = this.resolveReportTypeDescription(item as Record<string, unknown>);
            return {
                ...item,
                name: displayName,
                description: displayDescription,
                inputSchema: derived.inputSchema,
                outputSchema: derived.outputSchema,
                dataSourceIds: derived.dataSourceIds,
                ...(analysisTypeId ? { analysisTypeId } : {}),
            };
        });
    }

    /**
     * Maps a published INPUT_FIELD node's config to the portal's legacy input-schema entry shape.
     *
     * `label`, `placeholder` and `helpText` may be authored as plain strings (legacy) or as
     * `LocalizedText` objects (new builder). Both shapes are flattened here using the report's
     * `defaultLanguage` (falling back to English) so the analysis form can render them directly.
     */
    private inputEntryFromInputNode(
        cfg: Record<string, unknown>,
        defaultLanguage = 'en',
        key?: string,
    ): Record<string, unknown> {
        const type = (cfg['type'] as string | undefined) ?? 'string';
        const entry: Record<string, unknown> = {
            type,
            required: cfg['required'] !== false,
        };
        if (key) entry['key'] = key;
        const label = this.flattenLocalized(cfg['label'], defaultLanguage);
        if (label) entry['label'] = label;
        const placeholder = this.flattenLocalized(cfg['placeholder'], defaultLanguage);
        if (placeholder) entry['placeholder'] = placeholder;
        const helpText = this.flattenLocalized(cfg['helpText'], defaultLanguage);
        if (helpText) entry['helpText'] = helpText;
        if (cfg['minItems'] != null) entry['minItems'] = cfg['minItems'];
        if (cfg['fields']) entry['fields'] = cfg['fields'];
        return entry;
    }

    /**
     * Accepts either a plain string or a `{ defaultLanguage, values }` LocalizedText bag and
     * returns the best-matching string for the requested language. Empty results return `''`.
     */
    private flattenLocalized(raw: unknown, preferredLanguage: string): string {
        if (raw == null) return '';
        if (typeof raw === 'string') return raw;
        if (typeof raw !== 'object') return '';
        const lt = raw as { defaultLanguage?: string; values?: Record<string, string> };
        const values = lt.values ?? {};
        const lang = preferredLanguage ?? lt.defaultLanguage ?? 'en';
        return values[lang] ?? values[lt.defaultLanguage ?? 'en'] ?? values['en'] ?? '';
    }

    private extractNodeDefinitionReferences(version: Record<string, unknown>, assetId: Types.ObjectId): ReportTypeBuilderAssetReference[] {
        const references: ReportTypeBuilderAssetReference[] = [];
        const flowNodes = (version['flowNodes'] as Array<Record<string, unknown>> | undefined) ?? [];
        flowNodes.forEach((n, index) => {
            if (this.sameObjectId(n['definitionAssetId'], assetId)) {
                references.push({ kind: 'nodeDefinition', path: `flowNodes.${index}.definitionAssetId` });
            }
        });

        const snap = version['publishedFlowSnapshot'] as Record<string, unknown> | undefined;
        const snapDefs = (snap?.['nodeDefinitions'] as Array<Record<string, unknown>> | undefined) ?? [];
        snapDefs.forEach((d, index) => {
            if (this.sameObjectId(d?.['_id'], assetId)) {
                references.push({ kind: 'nodeDefinition', path: `publishedFlowSnapshot.nodeDefinitions.${index}._id` });
            }
        });
        const snapNodes = (snap?.['nodes'] as Array<Record<string, unknown>> | undefined) ?? [];
        snapNodes.forEach((n, index) => {
            if (this.sameObjectId(n?.['definitionAssetId'], assetId)) {
                references.push({ kind: 'nodeDefinition', path: `publishedFlowSnapshot.nodes.${index}.definitionAssetId` });
            }
        });
        return references;
    }

    private sameObjectId(value: unknown, expected: Types.ObjectId): boolean {
        if (!value) return false;
        try {
            return new Types.ObjectId(String(value)).equals(expected);
        } catch {
            return false;
        }
    }
}
