import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';
import { NodeType, NodeTypeDocument } from './node-type.schema';
import { CreateNodeTypeDto } from './dto/create-node-type.dto';

@Injectable()
export class NodeTypesService {
    constructor(@InjectModel(NodeType.name) private readonly model: Model<NodeTypeDocument>) {}

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
                { executionFamily: new RegExp(query.search, 'i') },
                { 'localizedName.values.en': new RegExp(query.search, 'i') },
                { 'localizedName.values.ar': new RegExp(query.search, 'i') },
            ];
        }

        const [items, total] = await Promise.all([
            this.model
                .find(filter)
                .sort({ builderCategoryKey: 1, slug: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
                .exec(),
            this.model.countDocuments(filter).exec(),
        ]);

        return { items, total, page, limit };
    }

    async findActiveMap(): Promise<Map<string, NodeType>> {
        const rows = await this.model.find({ status: BuilderAssetStatus.ACTIVE }).lean().exec();
        const map = new Map<string, NodeType>();
        for (const row of rows) {
            map.set(row.key, row as unknown as NodeType);
            map.set(row.slug, row as unknown as NodeType);
        }
        return map;
    }

    async findById(id: string) {
        const row = await this.model.findById(id).lean().exec();
        if (!row) throw new NotFoundException('Node type not found');
        return row;
    }

    create(dto: CreateNodeTypeDto) {
        return this.model.create({
            ...dto,
            status: dto.status ?? BuilderAssetStatus.ACTIVE,
            capabilities: dto.capabilities ?? [],
        });
    }

    async update(id: string, dto: Partial<CreateNodeTypeDto>) {
        const row = await this.model.findByIdAndUpdate(id, { $set: dto }, { new: true }).exec();
        if (!row) throw new NotFoundException('Node type not found');
        return row;
    }
}
