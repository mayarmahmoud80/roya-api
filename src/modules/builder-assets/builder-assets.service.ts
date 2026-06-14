import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import * as path from 'path';
import { BuilderAsset, BuilderAssetDocument } from './schemas/builder-asset.schema';
import { BuilderNodeDefinitionInputDto, NodeConnectionPointDto } from './dto/node-definition.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';
import { BuilderAssetType } from '../common/enums/builder-asset-type.enum';
import { NODE_CATEGORY_SORT_ORDER, NodeCategory, NodeKind } from '../common/enums/builder-node.enum';
import { NODE_KIND_TO_CATEGORY } from '../common/node-category-rules';
import { findSecretLikeKeyInConfig } from '../report-types/dynamic-flow-graph.validation';
import { ReportTypesService } from '../report-types/report-types.service';
import { mapConnectionPortsToNodeDtos } from '../providers/connection-contract.mapper';
import {
    getDataSourceConnectionContract,
    hasDataSourceConnectionContract,
} from '../providers/provider-connection-contracts.registry';
import { S3Service } from '../clients/s3/s3.service';
import { BuilderCategory, BuilderCategoryDocument } from '../builder-categories/builder-category.schema';
import { NodeType, NodeTypeDocument } from '../node-types/node-type.schema';

/** File shape from Nest `@UploadedFile()` (multipart). */
export interface BrandingUploadFile {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
}

const BRANDING_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const BRANDING_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export interface BuilderAssetQuery extends Omit<PaginationQueryDto, 'status'> {
    assetType?: BuilderAssetType;
    /** Builder asset lifecycle (distinct from publication status on PaginationQueryDto). */
    status?: BuilderAssetStatus;
    scope?: string;
}

export interface NodeDefinitionQuery extends Omit<BuilderAssetQuery, 'assetType'> {
    nodeKind?: NodeKind;
    /** When true, inactive/archived node definitions are included in the list. */
    includeInactive?: boolean;
    category?: NodeCategory;
    /** Comma-separated {@link NodeCategory} values. */
    categories?: string;
    builderCategoryKey?: string;
    nodeTypeKey?: string;
    sortBy?: 'updatedAt' | 'category' | 'builderCategory';
}

const NODE_CATEGORY_VALUES = new Set<string>(Object.values(NodeCategory));

export interface NodePaletteCategoryItem {
    _id: string;
    slug: string;
    /** Legacy field name preserved for the builder; now carries the dynamic builder-category key. */
    nodeCategoryKey: string;
    builderCategoryKey: string;
    name: Record<string, unknown>;
    description?: Record<string, unknown>;
    sortOrder: number;
    logoUrl?: string;
    iconClass?: string;
    accentColor?: string;
}

@Injectable()
export class BuilderAssetsService {
    constructor(
        @InjectModel(BuilderAsset.name) private readonly model: Model<BuilderAssetDocument>,
        @InjectModel(BuilderCategory.name) private readonly builderCategoryModel: Model<BuilderCategoryDocument>,
        @InjectModel(NodeType.name) private readonly nodeTypeModel: Model<NodeTypeDocument>,
        private readonly reportTypesService: ReportTypesService,
        private readonly s3Service: S3Service,
    ) {}

    async findAll(query: BuilderAssetQuery) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 25;
        const filter: FilterQuery<BuilderAssetDocument> = {};

        if (query.assetType) filter.assetType = query.assetType;
        if (query.status) filter.status = query.status;
        if (query.scope) filter.scope = query.scope;
        if (query.search) {
            filter.$or = [
                { slug: new RegExp(query.search, 'i') },
                { 'name.values.en': new RegExp(query.search, 'i') },
                { 'name.values.ar': new RegExp(query.search, 'i') },
            ];
        }

        const [items, total] = await Promise.all([
            this.model.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
            this.model.countDocuments(filter).exec(),
        ]);

        return { items, total, page, limit };
    }

    async listNodeDefinitions(query: NodeDefinitionQuery) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const filter = this.buildNodeDefinitionListFilter(query);
        const sortBy = query.sortBy ?? 'updatedAt';

        const total = await this.model.countDocuments(filter).exec();

        if (sortBy === 'category' || sortBy === 'builderCategory') {
            const categoryOrder = await this.listBuilderCategoryOrder();
            const pipeline: PipelineStage[] = [
                { $match: filter },
                {
                    $addFields: {
                        _catRank: {
                            $let: {
                                vars: {
                                    ix: {
                                        $indexOfArray: [
                                            categoryOrder,
                                            { $ifNull: ['$nodeDefinition.builderCategoryKey', '$nodeDefinition.category'] },
                                        ],
                                    },
                                },
                                in: { $cond: [{ $eq: ['$$ix', -1] }, 999, '$$ix'] },
                            },
                        },
                    },
                },
                { $sort: { _catRank: 1, 'nodeDefinition.builderCategoryKey': 1, slug: 1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit },
            ];
            const rawItems = await this.model.aggregate(pipeline).exec();
            return {
                items: rawItems.map(item => this.toNodeDefinitionResponse(item as Record<string, unknown>)),
                total,
                page,
                limit,
            };
        }

        const items = await this.model
            .find(filter)
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .exec();
        return {
            items: items.map(item => this.toNodeDefinitionResponse(item as Record<string, unknown>)),
            total,
            page,
            limit,
        };
    }

    private buildNodeDefinitionListFilter(query: NodeDefinitionQuery): FilterQuery<BuilderAssetDocument> {
        const filter: FilterQuery<BuilderAssetDocument> = { assetType: BuilderAssetType.NODE_DEFINITION };
        if (!query.includeInactive) {
            filter.status = query.status ?? BuilderAssetStatus.ACTIVE;
        } else if (query.status) {
            filter.status = query.status;
        }
        if (query.scope) filter.scope = query.scope;
        if (query.nodeKind) {
            filter['nodeDefinition.nodeKind'] = query.nodeKind;
        }
        if (query.builderCategoryKey?.trim()) {
            filter['nodeDefinition.builderCategoryKey'] = query.builderCategoryKey.trim();
        }
        if (query.nodeTypeKey?.trim()) {
            filter['nodeDefinition.nodeTypeKey'] = query.nodeTypeKey.trim();
        }
        const catFilters = this.parseNodeDefinitionCategoryFilters(query);
        if (catFilters?.length === 1) {
            filter['nodeDefinition.category'] = catFilters[0];
        } else if (catFilters && catFilters.length > 1) {
            filter['nodeDefinition.category'] = { $in: catFilters };
        }
        if (query.search) {
            filter['$or'] = [
                { slug: new RegExp(query.search, 'i') },
                { 'name.values.en': new RegExp(query.search, 'i') },
            ];
        }
        return filter;
    }

    private parseNodeDefinitionCategoryFilters(query: NodeDefinitionQuery): NodeCategory[] | undefined {
        const parts: NodeCategory[] = [];
        if (query.category) {
            parts.push(query.category);
        }
        if (query.categories?.trim()) {
            for (const raw of query.categories.split(',')) {
                const t = raw.trim();
                if (NODE_CATEGORY_VALUES.has(t)) {
                    parts.push(t as NodeCategory);
                }
            }
        }
        if (parts.length === 0) {
            return undefined;
        }
        return [...new Set(parts)];
    }

    private async listBuilderCategoryOrder(): Promise<string[]> {
        const rows = await this.builderCategoryModel
            .find({ status: BuilderAssetStatus.ACTIVE })
            .sort({ sortOrder: 1, slug: 1 })
            .lean()
            .exec();
        if (rows.length === 0) {
            return NODE_CATEGORY_SORT_ORDER.map(c => c as string);
        }
        return [...new Set([...rows.flatMap(row => [row.key, row.slug]), ...NODE_CATEGORY_SORT_ORDER.map(c => c as string)])];
    }

    toNodeDefinitionResponse(doc: BuilderAssetDocument | Record<string, unknown>) {
        const o = 'toObject' in doc && typeof doc.toObject === 'function' ? (doc as BuilderAssetDocument).toObject() : doc;
        const rec = o as Record<string, unknown>;
        return {
            _id: rec['_id'],
            ...((rec['nodeDefinition'] as Record<string, unknown>) ?? {}),
            name: rec['name'],
            slug: rec['slug'],
            description: rec['description'],
            scope: rec['scope'],
            organizationId: rec['organizationId'],
            status: rec['status'],
            createdAt: rec['createdAt'],
            updatedAt: rec['updatedAt'],
        };
    }

    /**
     * Flow builder palette — level-1 rows. Each row binds to {@link NodeCategory} via
     * `metadata.nodeCategoryKey`; labels and branding come from `name` / `description` /
     * `metadata.logoUrl` / `metadata.iconClass` / `metadata.accentColor` / `metadata.sortOrder`.
     */
    async listNodePaletteCategories(): Promise<{ items: NodePaletteCategoryItem[] }> {
        const rows = await this.builderCategoryModel
            .find({ status: BuilderAssetStatus.ACTIVE })
            .sort({ sortOrder: 1, slug: 1 })
            .lean()
            .exec();
        const items = rows.map(row => this.toNodePaletteCategoryItem(row));
        return { items };
    }

    private toNodePaletteCategoryItem(row: BuilderCategoryDocument | Record<string, unknown>): NodePaletteCategoryItem {
        const doc = 'toObject' in row && typeof row.toObject === 'function' ? row.toObject() : row;
        const rec = doc as Record<string, unknown>;
        const key = String(rec['key'] ?? rec['slug'] ?? '');
        const slug = String(rec['slug'] ?? key);
        const sortOrder = Number(rec['sortOrder'] ?? 0);
        const iconRaw = rec['icon'];
        const accentRaw = rec['color'];
        return {
            _id: String(rec['_id']),
            slug,
            nodeCategoryKey: key,
            builderCategoryKey: key,
            name: (rec['localizedName'] as Record<string, unknown>) ?? {},
            description: rec['localizedDescription'] as Record<string, unknown> | undefined,
            sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
            iconClass: typeof iconRaw === 'string' && iconRaw.trim() ? iconRaw.trim() : undefined,
            accentColor: typeof accentRaw === 'string' && accentRaw.trim() ? accentRaw.trim() : undefined,
        };
    }

    async uploadBrandingImage(file: BrandingUploadFile): Promise<{ url: string }> {
        if (!file?.buffer?.length) {
            throw new BadRequestException('Image file is required.');
        }
        if (file.size > BRANDING_IMAGE_MAX_BYTES) {
            throw new BadRequestException('Image must be at most 2 MB.');
        }
        if (!BRANDING_IMAGE_MIME.has(file.mimetype)) {
            throw new BadRequestException('Only PNG, JPEG, WebP, and GIF images are allowed.');
        }
        const rawName = file.originalname || 'image.png';
        const base = path.basename(rawName);
        const safeBase =
            base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'image.png';
        try {
            const { url } = await this.s3Service.uploadFile(file.buffer, safeBase, file.mimetype, 'roya-plus-builder-branding');
            return { url };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new BadRequestException(`Upload failed: ${msg}`);
        }
    }

    /**
     * SOURCE + `dataSource` nodes: ports are defined by the code provider; replace DTO ports
     * when the provider is registered so DB matches execution.
     */
    private applyDataSourcePortsFromProviderContract(dto: BuilderNodeDefinitionInputDto): void {
        const category = dto.category ?? NODE_KIND_TO_CATEGORY[dto.nodeKind];
        const providerKey = dto.providerKey?.trim();
        if (category !== NodeCategory.SOURCE || dto.nodeKind !== NodeKind.DATA_SOURCE || !providerKey) {
            return;
        }
        if (!hasDataSourceConnectionContract(providerKey)) {
            return;
        }
        const contract = getDataSourceConnectionContract(providerKey);
        if (!contract) return;
        dto.inputs = mapConnectionPortsToNodeDtos(contract.inputs);
        dto.outputs = mapConnectionPortsToNodeDtos(contract.outputs);
    }

    private validateNodeDefinitionShape(dto: BuilderNodeDefinitionInputDto): void {
        const err = (msg: string) => {
            throw new BadRequestException(msg);
        };
        if (dto.nodeKind !== NodeKind.TERMINAL && dto.inputs.length === 0 && dto.outputs.length === 0) {
            err('Node definitions (except terminal) need at least one input or one output port.');
        }
        if (findSecretLikeKeyInConfig(dto.configSchema) || findSecretLikeKeyInConfig(dto as unknown as Record<string, unknown>)) {
            err('Configuration must not use secret-like key names (password, token, etc.).');
        }
        const checkPorts = (ports: NodeConnectionPointDto[], path: string) => {
            const keys = new Set<string>();
            for (const p of ports) {
                if (keys.has(p.key)) {
                    err(`Duplicate connection key "${p.key}" in ${path}`);
                }
                keys.add(p.key);
                if (p.maxConnections != null && p.maxConnections < p.minConnections) {
                    err(`Port "${p.key}": maxConnections must be >= minConnections.`);
                }
            }
        };
        checkPorts(dto.inputs, 'inputs');
        checkPorts(dto.outputs, 'outputs');
    }

    buildNodeDefinitionPayload(dto: BuilderNodeDefinitionInputDto): Record<string, unknown> {
        this.validateNodeDefinitionShape(dto);
        const category: NodeCategory = dto.category ?? NODE_KIND_TO_CATEGORY[dto.nodeKind];
        return {
            nodeKind: dto.nodeKind,
            category,
            builderCategoryKey: dto.builderCategoryKey ?? category,
            nodeTypeKey: dto.nodeTypeKey,
            providerKey: dto.providerKey,
            icon: dto.icon,
            imageUrl: dto.imageUrl,
            inputs: dto.inputs,
            outputs: dto.outputs,
            allowedSourceKinds: dto.allowedSourceKinds,
            allowedSourceNodeTypeKeys: dto.allowedSourceNodeTypeKeys,
            allowedTargetKinds: dto.allowedTargetKinds,
            allowedTargetNodeTypeKeys: dto.allowedTargetNodeTypeKeys,
            configSchema: dto.configSchema,
            executionRole: dto.executionRole,
            defaultRequired: dto.defaultRequired,
            timeoutMs: dto.timeoutMs,
            retryPolicy: dto.retryPolicy,
        };
    }

    private async resolveDynamicNodeDefinitionKeys(
        dto: Pick<BuilderNodeDefinitionInputDto, 'builderCategoryKey' | 'nodeTypeKey' | 'category' | 'nodeKind'>,
    ): Promise<{ builderCategoryKey: string; nodeTypeKey?: string }> {
        const fallbackCategory = dto.category ?? NODE_KIND_TO_CATEGORY[dto.nodeKind];
        let builderCategoryKey = dto.builderCategoryKey?.trim() || String(fallbackCategory);
        const nodeTypeKey = dto.nodeTypeKey?.trim() || undefined;

        const builderCategory = await this.builderCategoryModel
            .findOne({ $or: [{ key: builderCategoryKey }, { slug: builderCategoryKey }] })
            .lean()
            .exec();
        if (!builderCategory) {
            throw new BadRequestException(`Unknown builderCategoryKey "${builderCategoryKey}".`);
        }
        builderCategoryKey = builderCategory.key;

        if (!nodeTypeKey) {
            return { builderCategoryKey };
        }

        const nodeType = await this.nodeTypeModel.findOne({ $or: [{ key: nodeTypeKey }, { slug: nodeTypeKey }] }).lean().exec();
        if (!nodeType) {
            throw new BadRequestException(`Unknown nodeTypeKey "${nodeTypeKey}".`);
        }
        if (nodeType.builderCategoryKey !== builderCategoryKey) {
            throw new BadRequestException(
                `Node type "${nodeType.key}" belongs to builder category "${nodeType.builderCategoryKey}", not "${builderCategoryKey}".`,
            );
        }
        return { builderCategoryKey, nodeTypeKey: nodeType.key };
    }

    async createNodeDefinition(dto: BuilderNodeDefinitionInputDto) {
        this.applyDataSourcePortsFromProviderContract(dto);
        const dynamicKeys = await this.resolveDynamicNodeDefinitionKeys(dto);
        const nodeDefinition = this.buildNodeDefinitionPayload({
            ...dto,
            builderCategoryKey: dynamicKeys.builderCategoryKey,
            nodeTypeKey: dynamicKeys.nodeTypeKey ?? dto.nodeTypeKey,
        });
        const status = dto.status ?? BuilderAssetStatus.ACTIVE;
        const created = await this.model.create({
            assetType: BuilderAssetType.NODE_DEFINITION,
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            scope: dto.scope,
            organizationId: dto.organizationId ? new Types.ObjectId(dto.organizationId) : undefined,
            status,
            nodeDefinition,
            metadata: {},
        });
        return this.toNodeDefinitionResponse(created);
    }

    async getNodeDefinition(id: string) {
        const doc = await this.model
            .findOne({ _id: id, assetType: BuilderAssetType.NODE_DEFINITION })
            .exec();
        if (!doc) {
            throw new NotFoundException('Node definition not found');
        }
        return this.toNodeDefinitionResponse(doc);
    }

    async updateNodeDefinition(id: string, dto: Partial<BuilderNodeDefinitionInputDto>) {
        const existing = await this.model.findOne({ _id: id, assetType: BuilderAssetType.NODE_DEFINITION }).exec();
        if (!existing) {
            throw new NotFoundException('Node definition not found');
        }
        const def = (existing.nodeDefinition ?? {}) as Record<string, unknown>;
        const next: BuilderNodeDefinitionInputDto = {
            nodeKind: (dto.nodeKind ?? def['nodeKind']) as NodeKind,
            category: (dto.category ?? def['category']) as NodeCategory | undefined,
            builderCategoryKey: (dto.builderCategoryKey ?? def['builderCategoryKey']) as string | undefined,
            nodeTypeKey: (dto.nodeTypeKey ?? def['nodeTypeKey']) as string | undefined,
            providerKey: dto.providerKey ?? (def['providerKey'] as string | undefined),
            icon: dto.icon ?? (def['icon'] as string | undefined),
            imageUrl: dto.imageUrl ?? (def['imageUrl'] as string | undefined),
            name: dto.name ?? (existing.name as unknown as BuilderNodeDefinitionInputDto['name']),
            slug: dto.slug ?? existing.slug,
            description: (dto.description ?? existing.description) as BuilderNodeDefinitionInputDto['description'],
            scope: dto.scope ?? existing.scope,
            organizationId: dto.organizationId ?? (existing.organizationId && String(existing.organizationId)),
            status: (dto.status ?? existing.status) as BuilderAssetStatus,
            inputs: dto.inputs ?? (def['inputs'] as BuilderNodeDefinitionInputDto['inputs']),
            outputs: dto.outputs ?? (def['outputs'] as BuilderNodeDefinitionInputDto['outputs']),
            allowedSourceKinds: dto.allowedSourceKinds ?? (def['allowedSourceKinds'] as NodeKind[] | undefined),
            allowedSourceNodeTypeKeys:
                dto.allowedSourceNodeTypeKeys ?? (def['allowedSourceNodeTypeKeys'] as string[] | undefined),
            allowedTargetKinds: dto.allowedTargetKinds ?? (def['allowedTargetKinds'] as NodeKind[] | undefined),
            allowedTargetNodeTypeKeys:
                dto.allowedTargetNodeTypeKeys ?? (def['allowedTargetNodeTypeKeys'] as string[] | undefined),
            configSchema: dto.configSchema ?? (def['configSchema'] as Record<string, unknown> | undefined),
            executionRole: dto.executionRole ?? (def['executionRole'] as BuilderNodeDefinitionInputDto['executionRole']),
            defaultRequired: dto.defaultRequired ?? (def['defaultRequired'] as boolean),
            timeoutMs: dto.timeoutMs ?? (def['timeoutMs'] as number | undefined),
            retryPolicy: dto.retryPolicy ?? (def['retryPolicy'] as BuilderNodeDefinitionInputDto['retryPolicy']),
        };
        if (next.status === BuilderAssetStatus.ARCHIVED && existing.status !== BuilderAssetStatus.ARCHIVED) {
            const { reportTypes } = await this.usage(String(existing._id));
            if (reportTypes.length > 0) {
                throw new ConflictException(
                    'Cannot archive this node definition while report types or versions still reference it. Remove it from draft or published flows first.',
                );
            }
        }
        this.applyDataSourcePortsFromProviderContract(next);
        this.validateNodeDefinitionShape(next);
        const dynamicKeys = await this.resolveDynamicNodeDefinitionKeys(next);
        const nodeDefinition = this.buildNodeDefinitionPayload({
            ...next,
            builderCategoryKey: dynamicKeys.builderCategoryKey,
            nodeTypeKey: dynamicKeys.nodeTypeKey ?? next.nodeTypeKey,
        });
        const updated = await this.model
            .findByIdAndUpdate(
                id,
                {
                    $set: {
                        name: next.name,
                        slug: next.slug,
                        description: next.description,
                        scope: next.scope,
                        status: next.status,
                        nodeDefinition,
                        organizationId: next.organizationId ? new Types.ObjectId(next.organizationId) : undefined,
                    },
                },
                { new: true },
            )
            .exec();
        if (!updated) {
            throw new NotFoundException('Node definition not found');
        }
        return this.toNodeDefinitionResponse(updated);
    }

    create(dto: object) {
        return this.model.create(dto);
    }

    async update(id: string, dto: object) {
        const item = await this.model.findByIdAndUpdate(id, { $set: dto }, { new: true }).exec();
        if (!item) {
            throw new NotFoundException('Builder asset not found');
        }
        return item;
    }

    async usage(id: string) {
        const item = await this.model.findById(id).lean().exec();
        if (!item) {
            throw new NotFoundException('Builder asset not found');
        }
        const reportTypes = await this.reportTypesService.findUsageByBuilderAssetId(id);
        return { reportTypes, analysisTypes: [] };
    }
}
