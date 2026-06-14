import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';
import { AnalysisCategoryDocument, AnalysisCategoryEntity } from './analysis-category.schema';
import { CreateAnalysisCategoryDto } from './dto/create-analysis-category.dto';

@Injectable()
export class AnalysisCategoriesService {
    constructor(@InjectModel(AnalysisCategoryEntity.name) private readonly model: Model<AnalysisCategoryDocument>) {}

    async findAll(query: PaginationQueryDto = new PaginationQueryDto()) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 50;
        const filter: Record<string, unknown> = {};
        if (query.status) {
            filter.status = query.status;
        }
        if (query.search) {
            filter.$or = [
                { slug: new RegExp(query.search, 'i') },
                { key: new RegExp(query.search, 'i') },
                { 'localizedName.values.en': new RegExp(query.search, 'i') },
                { 'localizedName.values.ar': new RegExp(query.search, 'i') },
            ];
        }

        const [items, total] = await Promise.all([
            this.model
                .find(filter)
                .sort({ sortOrder: 1, slug: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
                .exec(),
            this.model.countDocuments(filter).exec(),
        ]);

        return { items, total, page, limit };
    }

    async findActiveMap(): Promise<Map<string, AnalysisCategoryEntity>> {
        const rows = await this.model
            .find({ status: BuilderAssetStatus.ACTIVE })
            .sort({ sortOrder: 1, slug: 1 })
            .lean()
            .exec();
        const map = new Map<string, AnalysisCategoryEntity>();
        for (const row of rows) {
            map.set(String(row._id), row as unknown as AnalysisCategoryEntity);
            map.set(row.slug, row as unknown as AnalysisCategoryEntity);
            map.set(row.key, row as unknown as AnalysisCategoryEntity);
        }
        return map;
    }

    async findById(id: string) {
        const row = await this.model.findById(id).lean().exec();
        if (!row) throw new NotFoundException('Analysis category not found');
        return row;
    }

    create(dto: CreateAnalysisCategoryDto) {
        return this.model.create({
            ...dto,
            sortOrder: dto.sortOrder ?? 0,
            status: dto.status ?? BuilderAssetStatus.ACTIVE,
            isSystem: dto.isSystem ?? false,
        });
    }

    async update(id: string, dto: Partial<CreateAnalysisCategoryDto>) {
        const row = await this.model.findByIdAndUpdate(id, { $set: dto }, { new: true }).exec();
        if (!row) throw new NotFoundException('Analysis category not found');
        return row;
    }
}
