import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Analysis, AnalysisDocument } from '../analyses/analysis.schema';
import { AnalysisType, AnalysisTypeDocument } from './analysis-type.schema';
import { AnalysisReportTypeRefDto, CreateAnalysisTypeDto } from './dto/create-analysis-type.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AssetScope } from '../common/enums/asset-scope.enum';
import { PublicationStatus } from '../common/enums/publication-status.enum';
import { ReportType, ReportTypeDocument } from '../report-types/report-type.schema';
import { AnalysisStatus } from '../common/enums';
import { AnalysisCategoryDocument, AnalysisCategoryEntity } from '../analysis-categories/analysis-category.schema';

@Injectable()
export class AnalysisTypesService {
    constructor(
        @InjectModel(AnalysisType.name) private readonly model: Model<AnalysisTypeDocument>,
        @InjectModel(ReportType.name) private readonly reportTypeModel: Model<ReportTypeDocument>,
        @InjectModel(Analysis.name) private readonly analysisModel: Model<AnalysisDocument>,
        @InjectModel(AnalysisCategoryEntity.name) private readonly analysisCategoryModel: Model<AnalysisCategoryDocument>,
    ) {}

    async findAll(query: PaginationQueryDto = new PaginationQueryDto()) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 25;
        const filter: Record<string, unknown> = { isActive: true };
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

        const [items, total, categories] = await Promise.all([
            this.model.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
            this.model.countDocuments(filter).exec(),
            this.analysisCategoryModel.find().lean().exec(),
        ]);

        return { items: this.attachCategoryMetadata(items as Record<string, unknown>[], categories), total, page, limit };
    }

    async findById(id: string) {
        const [item, categories] = await Promise.all([
            this.model.findOne({ _id: id, isActive: true }).lean().exec(),
            this.analysisCategoryModel.find().lean().exec(),
        ]);
        if (!item) throw new NotFoundException('Analysis type not found');
        return this.attachCategoryMetadata([item as Record<string, unknown>], categories)[0];
    }

    async create(dto: CreateAnalysisTypeDto) {
        const analysisCategoryId = await this.resolveAnalysisCategoryId(dto);
        return this.model.create({
            ...dto,
            analysisCategoryId,
            legacyCategory: dto.category,
            localizedName: dto.localizedName ?? this.localizedFromString(dto.name),
            localizedDescription: dto.localizedDescription ?? (dto.description ? this.localizedFromString(dto.description) : undefined),
            scope: dto.scope ?? AssetScope.GLOBAL,
            status: PublicationStatus.DRAFT,
            reportTypes: this.normalizeReportTypeRefs(dto.reportTypes ?? []),
        });
    }

    async update(id: string, dto: Partial<CreateAnalysisTypeDto>) {
        const analysisCategoryId = await this.resolveAnalysisCategoryId(dto, false);
        const item = await this.model.findByIdAndUpdate(id, {
            $set: {
                ...dto,
                ...(analysisCategoryId ? { analysisCategoryId } : {}),
                ...(dto.category ? { legacyCategory: dto.category } : {}),
                localizedName: dto.localizedName ?? (dto.name ? this.localizedFromString(dto.name) : undefined),
                localizedDescription: dto.localizedDescription ?? (dto.description ? this.localizedFromString(dto.description) : undefined),
                reportTypes: dto.reportTypes ? this.normalizeReportTypeRefs(dto.reportTypes) : undefined,
            },
        }, { new: true }).exec();
        if (!item) throw new NotFoundException('Analysis type not found');
        return item;
    }

    async publish(id: string) {
        const item = await this.model.findById(id).exec();
        if (!item) throw new NotFoundException('Analysis type not found');

        const issues = await this.validateForPublish(item.reportTypes ?? []);
        if (issues.length > 0) {
            throw new UnprocessableEntityException({ blockingErrors: issues, warnings: [] });
        }

        item.status = PublicationStatus.PUBLISHED;
        await item.save();
        return item;
    }

    async unpublish(id: string) {
        const item = await this.model.findById(id).exec();
        if (!item) throw new NotFoundException('Analysis type not found');

        item.status = PublicationStatus.DRAFT;
        await item.save();
        return item;
    }

    async remove(id: string) {
        const existing = await this.model.findById(id).exec();
        if (!existing) throw new NotFoundException('Analysis type not found');

        const usageCount = await this.analysisModel
            .countDocuments({ analysisTypeIds: new Types.ObjectId(id) , status: { $ne: AnalysisStatus.RUNNING } })
            .exec();
        if (usageCount > 0) {
            throw new ConflictException(
                `Cannot delete: ${usageCount} analysis run(s) reference this analysis type`,
            );
        }

        await this.model.findByIdAndDelete(id).exec();
        return { deleted: true };
    }

    private normalizeReportTypeRefs(refs: AnalysisReportTypeRefDto[]) {
        return refs
            .map(ref => ({
                reportTypeId: new Types.ObjectId(ref.reportTypeId),
                reportTypeVersionId: ref.reportTypeVersionId ? new Types.ObjectId(ref.reportTypeVersionId) : undefined,
                order: ref.order,
            }))
            .sort((a, b) => a.order - b.order);
    }

    private async validateForPublish(refs: Array<{ reportTypeId: Types.ObjectId; reportTypeVersionId?: Types.ObjectId; order: number }>) {
        const issues: Array<{ code: string; path: string; message: string }> = [];
        if (refs.length === 0) {
            issues.push({ code: 'analysis.reportTypes.required', path: 'reportTypes', message: 'At least one published report type is required.' });
        }

        const orders = new Set<number>();
        refs.forEach((ref, index) => {
            if (!Number.isInteger(ref.order) || ref.order < 1) {
                issues.push({ code: 'analysis.reportTypes.order.invalid', path: `reportTypes.${index}.order`, message: 'Report type order must be a positive integer.' });
            }
            if (orders.has(ref.order)) {
                issues.push({ code: 'analysis.reportTypes.order.duplicate', path: `reportTypes.${index}.order`, message: 'Report type order must be unique.' });
            }
            orders.add(ref.order);
        });

        const reportTypes = await this.reportTypeModel.find({ _id: { $in: refs.map(ref => ref.reportTypeId) } }).lean().exec();
        const reportTypeById = new Map(reportTypes.map(reportType => [String(reportType._id), reportType]));

        refs.forEach((ref, index) => {
            const reportType = reportTypeById.get(String(ref.reportTypeId));
            if (!reportType || reportType.status !== PublicationStatus.PUBLISHED || !reportType.currentPublishedVersionId) {
                issues.push({ code: 'analysis.reportTypes.unpublished', path: `reportTypes.${index}.reportTypeId`, message: 'Only published report types can be attached.' });
                return;
            }

            if (ref.reportTypeVersionId && String(ref.reportTypeVersionId) !== String(reportType.currentPublishedVersionId)) {
                issues.push({ code: 'analysis.reportTypes.versionMismatch', path: `reportTypes.${index}.reportTypeVersionId`, message: 'Attached version must match the current published report version.' });
            }
        });

        return issues;
    }

    private localizedFromString(value: string) {
        return { defaultLanguage: 'en', values: { en: value } };
    }

    private async resolveAnalysisCategoryId(
        dto: Partial<CreateAnalysisTypeDto>,
        throwIfMissing = true,
    ): Promise<Types.ObjectId | undefined> {
        if (dto.analysisCategoryId) {
            return new Types.ObjectId(dto.analysisCategoryId);
        }
        if (!dto.category) {
            return undefined;
        }
        const row = await this.analysisCategoryModel
            .findOne({ $or: [{ key: dto.category }, { slug: dto.category }] })
            .lean()
            .exec();
        if (!row) {
            if (!throwIfMissing) return undefined;
            throw new NotFoundException(`Analysis category "${dto.category}" not found`);
        }
        return row._id as Types.ObjectId;
    }

    private attachCategoryMetadata(items: Record<string, unknown>[], categories: Array<Record<string, unknown>>) {
        const byId = new Map<string, Record<string, unknown>>();
        const bySlug = new Map<string, Record<string, unknown>>();
        for (const row of categories) {
            byId.set(String(row._id), row);
            if (typeof row.slug === 'string') bySlug.set(row.slug, row);
            if (typeof row.key === 'string') bySlug.set(row.key, row);
        }
        return items.map(item => {
            const categoryId = item.analysisCategoryId ? String(item.analysisCategoryId) : '';
            const category =
                (categoryId ? byId.get(categoryId) : undefined) ??
                (typeof item.legacyCategory === 'string' ? bySlug.get(item.legacyCategory) : undefined);
            return {
                ...item,
                category: category?.slug ?? item.legacyCategory,
                analysisCategory: category,
            };
        });
    }
}
