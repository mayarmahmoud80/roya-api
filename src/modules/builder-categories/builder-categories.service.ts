import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';
import { BuilderCategory, BuilderCategoryDocument } from './builder-category.schema';
import { CreateBuilderCategoryDto } from './dto/create-builder-category.dto';

@Injectable()
export class BuilderCategoriesService {
    constructor(@InjectModel(BuilderCategory.name) private readonly model: Model<BuilderCategoryDocument>) {}

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

    async findPolicyMap(): Promise<Map<string, string[]>> {
        const rows = await this.model.find({ status: BuilderAssetStatus.ACTIVE }).lean().exec();
        const map = new Map<string, string[]>();
        for (const row of rows) {
            const outgoing = Array.isArray(row.allowedOutgoingCategoryKeys) ? row.allowedOutgoingCategoryKeys : [];
            map.set(row.key, outgoing);
            map.set(row.slug, outgoing);
        }
        return map;
    }

    async findById(id: string) {
        const row = await this.model.findById(id).lean().exec();
        if (!row) throw new NotFoundException('Builder category not found');
        return row;
    }

    create(dto: CreateBuilderCategoryDto) {
        return this.model.create({
            ...dto,
            sortOrder: dto.sortOrder ?? 0,
            status: dto.status ?? BuilderAssetStatus.ACTIVE,
            isSystem: dto.isSystem ?? false,
            allowedOutgoingCategoryKeys: dto.allowedOutgoingCategoryKeys ?? [],
            allowedIncomingCategoryKeys: dto.allowedIncomingCategoryKeys ?? [],
        });
    }

    async update(id: string, dto: Partial<CreateBuilderCategoryDto>) {
        const row = await this.model.findByIdAndUpdate(id, { $set: dto }, { new: true }).exec();
        if (!row) throw new NotFoundException('Builder category not found');
        return row;
    }
}
