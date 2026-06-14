jest.mock('../integrations/s3/s3.service', () => ({
    S3Service: jest.fn().mockImplementation(() => ({
        uploadFile: jest.fn().mockResolvedValue({ url: 'https://example.com/x.png', key: 'k', bucket: 'b' }),
    })),
}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { BuilderAssetsService } from './builder-assets.service';
import { BuilderNodeDefinitionInputDto } from './dto/node-definition.dto';
import { BuilderAssetType } from '../common/enums/builder-asset-type.enum';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';
import { AssetScope } from '../common/enums/asset-scope.enum';
import {
    NodeKind,
    NodeCategory,
    BuilderValueType,
    NodeConnectionDirection,
    BuilderNodeExecutionRole,
} from '../common/enums/builder-node.enum';

const createModel = () => {
    const documents: Record<string, unknown>[] = [];
    return {
        documents,
        find: jest.fn(() => ({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => documents),
        })),
        countDocuments: jest.fn(() => ({ exec: jest.fn(async () => documents.length) })),
        create: jest.fn(async dto => ({ _id: '507f1f77bcf86cd799439011', ...dto })),
        findByIdAndUpdate: jest.fn((id: string, update: { $set: Record<string, unknown> }) => ({
            exec: jest.fn(async () => {
                const doc = documents.find(item => item['_id'] === id);
                if (!doc) return null;
                Object.assign(doc, update.$set);
                return doc;
            }),
        })),
        findById: jest.fn((id: string) => ({
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => documents.find(item => item['_id'] === id) ?? null),
        })),
    };
};

const s3Mock = { uploadFile: jest.fn() };

const createBuilderCategoryModel = (rows: Record<string, unknown>[] = []) => ({
    find: jest.fn(() => ({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn(async () => rows),
    })),
    findOne: jest.fn((query: { $or: Array<Record<string, string>> }) => ({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn(async () => rows.find(row => query.$or.some(cond => Object.entries(cond).every(([k, v]) => row[k] === v))) ?? null),
    })),
});

const createNodeTypeModel = (rows: Record<string, unknown>[] = []) => ({
    findOne: jest.fn((query: { $or: Array<Record<string, string>> }) => ({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn(async () => rows.find(row => query.$or.some(cond => Object.entries(cond).every(([k, v]) => row[k] === v))) ?? null),
    })),
});

const createService = (
    model: unknown,
    reportTypesService: unknown = { findUsageByBuilderAssetId: jest.fn() },
    builderCategories: Record<string, unknown>[] = [{ _id: 'bc-source', key: 'source', slug: 'source', sortOrder: 0, status: BuilderAssetStatus.ACTIVE }],
    nodeTypes: Record<string, unknown>[] = [],
) =>
    new BuilderAssetsService(
        model as never,
        createBuilderCategoryModel(builderCategories) as never,
        createNodeTypeModel(nodeTypes) as never,
        reportTypesService as never,
        s3Mock as never,
    );

describe('BuilderAssetsService', () => {
    it('creates and lists assets with pagination shape', async () => {
        const model = createModel();
        const service = createService(model);

        await service.create({ slug: 'text' } as never);
        const result = await service.findAll({ page: 1, limit: 25 });

        expect(model.create).toHaveBeenCalled();
        expect(result).toEqual(expect.objectContaining({ total: 0, page: 1, limit: 25 }));
    });

    it('throws when updating a missing asset', async () => {
        const service = createService(createModel());

        await expect(service.update('missing', {} as never)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns report type usage for a referenced asset', async () => {
        const model = createModel();
        const assetId = '507f1f77bcf86cd799439011';
        model.documents.push({ _id: assetId, slug: 'text' });
        const reportTypes = [{ reportTypeSlug: 'brand-overview', references: [{ kind: 'inputFieldType' }] }];
        const service = createService(model, {
            findUsageByBuilderAssetId: jest.fn(async () => reportTypes),
        });

        await expect(service.usage(assetId)).resolves.toEqual({ reportTypes, analysisTypes: [] });
    });

    it('listNodeDefinitions defaults to active assets only (palette)', async () => {
        const findMock = jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => []),
        });
        const model = { ...createModel(), find: findMock, countDocuments: jest.fn().mockReturnValue({ exec: jest.fn(async () => 0) }) };
        const service = createService(model);
        await service.listNodeDefinitions({ page: 1, limit: 20 });
        expect(findMock).toHaveBeenCalledWith(
            expect.objectContaining({ assetType: BuilderAssetType.NODE_DEFINITION, status: BuilderAssetStatus.ACTIVE }),
        );
    });

    it('listNodeDefinitions applies category filter for admin query', async () => {
        const findMock = jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => []),
        });
        const model = { ...createModel(), find: findMock, countDocuments: jest.fn().mockReturnValue({ exec: jest.fn(async () => 0) }) };
        const service = createService(model);
        await service.listNodeDefinitions({ page: 1, limit: 20, includeInactive: true, category: NodeCategory.SCHEMA });
        expect(findMock).toHaveBeenCalledWith(
            expect.objectContaining({
                assetType: BuilderAssetType.NODE_DEFINITION,
                'nodeDefinition.category': NodeCategory.SCHEMA,
            }),
        );
    });

    it('listNodeDefinitions applies multi-category filter from comma-separated categories', async () => {
        const findMock = jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => []),
        });
        const model = { ...createModel(), find: findMock, countDocuments: jest.fn().mockReturnValue({ exec: jest.fn(async () => 0) }) };
        const service = createService(model);
        await service.listNodeDefinitions({ page: 1, limit: 20, includeInactive: true, categories: 'schema, ai' });
        expect(findMock).toHaveBeenCalledWith(
            expect.objectContaining({
                assetType: BuilderAssetType.NODE_DEFINITION,
                'nodeDefinition.category': { $in: [NodeCategory.SCHEMA, NodeCategory.AI] },
            }),
        );
    });

    it('listNodeDefinitions uses aggregation pipeline when sortBy is category', async () => {
        const aggregateMock = jest.fn().mockReturnValue({ exec: jest.fn(async () => []) });
        const findMock = jest.fn();
        const model = {
            ...createModel(),
            find: findMock,
            aggregate: aggregateMock,
            countDocuments: jest.fn().mockReturnValue({ exec: jest.fn(async () => 0) }),
        };
        const service = createService(
            model,
            undefined,
            [
                { _id: 'bc1', key: 'intake', slug: 'intake', sortOrder: 0, status: BuilderAssetStatus.ACTIVE },
                { _id: 'bc2', key: 'reasoning', slug: 'reasoning', sortOrder: 1, status: BuilderAssetStatus.ACTIVE },
            ],
        );
        await service.listNodeDefinitions({ page: 1, limit: 20, includeInactive: true, sortBy: 'category' });
        expect(aggregateMock).toHaveBeenCalled();
        expect(findMock).not.toHaveBeenCalled();
    });

    it('listNodePaletteCategories reads dynamic builder categories', async () => {
        const model = { find: jest.fn() } as never;
        const service = createService(
            model,
            undefined,
            [
                {
                    _id: '507f1f77bcf86cd7994390cc',
                    key: 'intake',
                    slug: 'intake',
                    localizedName: { defaultLanguage: 'en', values: { en: 'Inputs' } },
                    sortOrder: 0,
                    status: BuilderAssetStatus.ACTIVE,
                },
                {
                    _id: '507f1f77bcf86cd7994390aa',
                    key: 'reasoning',
                    slug: 'reasoning',
                    localizedName: { defaultLanguage: 'en', values: { en: 'AI' } },
                    localizedDescription: { defaultLanguage: 'en', values: { en: 'Models' } },
                    icon: 'pi-sparkles',
                    color: '#f00',
                    sortOrder: 2,
                    status: BuilderAssetStatus.ACTIVE,
                },
            ],
        );
        const result = await service.listNodePaletteCategories();
        expect(result.items.map(i => i.slug)).toEqual(['intake', 'reasoning']);
        expect(result.items[1]).toMatchObject({
            slug: 'reasoning',
            nodeCategoryKey: 'reasoning',
            builderCategoryKey: 'reasoning',
            sortOrder: 2,
            iconClass: 'pi-sparkles',
        });
    });

    it('rejects archive when a node definition is still in use by report type versions', async () => {
        const id = '507f1f77bcf86cd7994390aa';
        const nodeDefinition = {
            nodeKind: NodeKind.TERMINAL,
            inputs: [
                {
                    key: 'in',
                    direction: NodeConnectionDirection.INPUT,
                    label: { defaultLanguage: 'en', values: { en: 'in' } },
                    valueType: BuilderValueType.ANY,
                    required: true,
                    minConnections: 1,
                    compatibleValueTypes: [BuilderValueType.ANY],
                },
            ],
            outputs: [],
            executionRole: BuilderNodeExecutionRole.TERMINAL,
        };
        const existingDoc = {
            _id: id,
            slug: 'nd-x',
            name: { defaultLanguage: 'en', values: { en: 'X' } },
            scope: 'global',
            status: BuilderAssetStatus.ACTIVE,
            nodeDefinition,
        };
        const findOne = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(existingDoc),
        });
        const findById = jest.fn().mockReturnValue({
            lean: () => ({ exec: jest.fn().mockResolvedValue(existingDoc) }),
        });
        const model = { findOne, findById, findByIdAndUpdate: jest.fn() } as never;
        const service = createService(model, {
            findUsageByBuilderAssetId: jest.fn(async () => [
                { reportTypeSlug: 'r1', versionNumber: 1, references: [{ kind: 'nodeDefinition' }] },
            ]),
        });
        await expect(service.updateNodeDefinition(id, { status: BuilderAssetStatus.ARCHIVED })).rejects.toBeInstanceOf(ConflictException);
    });

    it('accepts required output port with minConnections 0 (provider payload pattern)', () => {
        const service = createService(createModel());
        const dto: BuilderNodeDefinitionInputDto = {
            nodeKind: NodeKind.DATA_SOURCE,
            slug: 'nd-source-browserless',
            name: { defaultLanguage: 'en', values: { en: 'Browserless Scraper' } },
            scope: AssetScope.GLOBAL,
            executionRole: BuilderNodeExecutionRole.SOURCE,
            defaultRequired: true,
            inputs: [
                {
                    key: 'websiteUrl',
                    direction: NodeConnectionDirection.INPUT,
                    label: { defaultLanguage: 'en', values: { en: 'websiteUrl' } },
                    valueType: BuilderValueType.STRING,
                    required: true,
                    minConnections: 1,
                    compatibleValueTypes: [BuilderValueType.STRING, BuilderValueType.ANY],
                },
            ],
            outputs: [
                {
                    key: 'payload',
                    direction: NodeConnectionDirection.OUTPUT,
                    label: { defaultLanguage: 'en', values: { en: 'payload' } },
                    valueType: BuilderValueType.OBJECT,
                    required: true,
                    minConnections: 0,
                    compatibleValueTypes: [BuilderValueType.OBJECT, BuilderValueType.ANY],
                },
            ],
        };
        const payload = service.buildNodeDefinitionPayload(dto);
        expect(payload.outputs).toEqual(
            expect.arrayContaining([expect.objectContaining({ key: 'payload', required: true, minConnections: 0 })]),
        );
    });

    it('listNodeDefinitions applies builderCategoryKey and nodeTypeKey filters', async () => {
        const findMock = jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => []),
        });
        const model = { ...createModel(), find: findMock, countDocuments: jest.fn().mockReturnValue({ exec: jest.fn(async () => 0) }) };
        const service = createService(model);
        await service.listNodeDefinitions({
            page: 1,
            limit: 20,
            includeInactive: true,
            builderCategoryKey: 'reasoning',
            nodeTypeKey: 'structured-ai-generator',
        });
        expect(findMock).toHaveBeenCalledWith(
            expect.objectContaining({
                assetType: BuilderAssetType.NODE_DEFINITION,
                'nodeDefinition.builderCategoryKey': 'reasoning',
                'nodeDefinition.nodeTypeKey': 'structured-ai-generator',
            }),
        );
    });
});
