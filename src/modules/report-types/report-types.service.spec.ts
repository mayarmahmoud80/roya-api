import { NotFoundException } from '@nestjs/common';
import { ReportTypesService } from './report-types.service';
import { PublicationStatus } from '../common/enums/publication-status.enum';

const leanChain = (result: unknown) => ({
    lean: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    exec: jest.fn(async () => result),
});

const stubBuilderAssets = {
    find: jest.fn(() => leanChain([])),
};

const stubBuilderCategories = {
    find: jest.fn(() => leanChain([])),
};

const stubNodeTypes = {
    find: jest.fn(() => leanChain([])),
};

const stubDataSources = {
    find: jest.fn(() => leanChain([])),
    findOne: jest.fn(() => leanChain(null)),
};

const stubAnalysisTypes = {
    find: jest.fn(() => leanChain([])),
    findOne: jest.fn(() => leanChain(null)),
};

const stubValidation = { validateDynamicReportFlow: jest.fn() };

const createModel = () => {
    const documents: Record<string, unknown>[] = [];
    return {
        documents,
        create: jest.fn(async (dto: Record<string, unknown>) => {
            const doc = {
                _id: (dto['_id'] as string) ?? `${documents.length + 1}`.padStart(24, '0'),
                ...dto,
                save: jest.fn(async function save(this: Record<string, unknown>) {
                    return this;
                }),
            };
            documents.push(doc);
            return doc;
        }),
        findById: jest.fn((id: string) => ({
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => documents.find(doc => doc['_id'] === id) ?? null),
        })),
        findByIdAndUpdate: jest.fn((id: string, update: { $set: Record<string, unknown> }, _opts?: unknown) => ({
            exec: jest.fn(async () => {
                const doc = documents.find(item => item['_id'] === id);
                if (!doc) return null;
                Object.assign(doc, update.$set);
                return doc;
            }),
        })),
        find: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => documents),
        })),
        findOne: jest.fn(() => ({
            lean: jest.fn().mockReturnThis(),
            populate: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => documents[0] ?? null),
        })),
        countDocuments: jest.fn(() => ({
            exec: jest.fn(async () => documents.length),
        })),
    };
};

const buildService = (reportTypeModel: ReturnType<typeof createModel>, versionModel: ReturnType<typeof createModel>) =>
    new ReportTypesService(
        reportTypeModel as never,
        versionModel as never,
        stubBuilderAssets as never,
        stubBuilderCategories as never,
        stubNodeTypes as never,
        stubDataSources as never,
        stubAnalysisTypes as never,
        stubValidation as never,
    );

describe('ReportTypesService (DAG-only)', () => {
    beforeEach(() => {
        stubBuilderAssets.find.mockClear();
        stubBuilderCategories.find.mockClear();
        stubNodeTypes.find.mockClear();
        stubValidation.validateDynamicReportFlow.mockReset();
        stubValidation.validateDynamicReportFlow.mockResolvedValue({
            blockingErrors: [],
            warnings: [],
            graphStats: { nodeCount: 0, connectionCount: 0, terminalPathCount: 0 },
            checkedAt: new Date(),
            targetType: 'reportFlow',
        });
    });

    it('creates a report type with an empty draft flow version', async () => {
        const reportTypeModel = createModel();
        const versionModel = createModel();
        const service = buildService(reportTypeModel, versionModel);

        const result = await service.create({
            localizedName: { defaultLanguage: 'en', values: { en: 'Brand Overview' } },
            slug: 'brand-overview',
        } as never);

        expect(result.status).toEqual(PublicationStatus.DRAFT);
        expect(result.draftVersionId).toBeDefined();
        expect(versionModel.create).toHaveBeenCalledWith(
            expect.objectContaining({
                versionNumber: 1,
                status: PublicationStatus.DRAFT,
                flowNodes: [],
                flowConnections: [],
            }),
        );
    });

    it('returns builder taxonomy alongside report flow payload', async () => {
        const reportTypeModel = createModel();
        const versionModel = createModel();
        await reportTypeModel.create({
            _id: '507f1f77bcf86cd799439012',
            slug: 'brand-overview',
            localizedName: { defaultLanguage: 'en', values: { en: 'Brand Overview' } },
            draftVersionId: '507f1f77bcf86cd799439013',
        });
        await versionModel.create({
            _id: '507f1f77bcf86cd799439013',
            reportTypeId: '507f1f77bcf86cd799439012',
            versionNumber: 1,
            status: PublicationStatus.DRAFT,
            flowNodes: [],
            flowConnections: [],
        });
        stubBuilderCategories.find.mockReturnValue(leanChain([{ key: 'intake', slug: 'intake' }]));
        stubNodeTypes.find.mockReturnValue(
            leanChain([{ key: 'url-input', slug: 'url-input', builderCategoryKey: 'intake' }]),
        );

        const service = buildService(reportTypeModel, versionModel);
        const result = await service.getReportFlow('507f1f77bcf86cd799439012');

        expect(result).toEqual(
            expect.objectContaining({
                availableBuilderCategories: [{ key: 'intake', slug: 'intake' }],
                availableNodeTypes: [{ key: 'url-input', slug: 'url-input', builderCategoryKey: 'intake' }],
            }),
        );
    });

    it('throws when saving a flow for a missing report type', async () => {
        const service = buildService(createModel(), createModel());
        await expect(
            service.saveReportFlow('507f1f77bcf86cd799439099', { flowNodes: [], flowConnections: [] } as never),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('detects node-definition references inside a version', async () => {
        const reportTypeModel = createModel();
        const versionModel = createModel();
        const assetId = '507f1f77bcf86cd799439011';

        const reportType = await reportTypeModel.create({
            _id: '507f1f77bcf86cd799439012',
            slug: 'brand-overview',
            localizedName: { defaultLanguage: 'en', values: { en: 'Brand Overview' } },
            isActive: true,
        });
        await versionModel.create({
            _id: '507f1f77bcf86cd799439013',
            reportTypeId: reportType._id,
            versionNumber: 1,
            status: PublicationStatus.DRAFT,
            flowNodes: [
                { nodeId: 'n-1', definitionAssetId: assetId, nodeKind: 'dataSource' },
            ],
            flowConnections: [],
        });

        const service = buildService(reportTypeModel, versionModel);
        const usage = await service.findUsageByBuilderAssetId(assetId);

        expect(usage).toHaveLength(1);
        expect(usage[0].reportTypeSlug).toEqual('brand-overview');
        expect(usage[0].references).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: 'nodeDefinition' }),
            ]),
        );
    });

    it('normalizes dynamic node metadata before saving a flow draft', async () => {
        const reportTypeModel = createModel();
        const versionModel = createModel();
        const reportType = await reportTypeModel.create({
            _id: '507f1f77bcf86cd799439012',
            slug: 'brand-overview',
            localizedName: { defaultLanguage: 'en', values: { en: 'Brand Overview' } },
            draftVersionId: '507f1f77bcf86cd799439013',
            save: jest.fn(async function save(this: Record<string, unknown>) {
                return this;
            }),
        });
        await versionModel.create({
            _id: '507f1f77bcf86cd799439013',
            reportTypeId: reportType._id,
            versionNumber: 1,
            status: PublicationStatus.DRAFT,
            flowNodes: [],
            flowConnections: [],
        });

        stubBuilderAssets.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => [
                {
                    _id: '507f1f77bcf86cd799439011',
                    assetType: 'nodeDefinition',
                    status: 'active',
                    nodeDefinition: {
                        nodeKind: 'inputField',
                        category: 'input',
                        builderCategoryKey: 'intake',
                        nodeTypeKey: 'url-input',
                        inputs: [],
                        outputs: [],
                        executionRole: 'source',
                    },
                },
            ]),
        });

        const service = buildService(reportTypeModel, versionModel);
        await service.saveReportFlow('507f1f77bcf86cd799439012', {
            flowNodes: [
                {
                    nodeId: 'n1',
                    definitionAssetId: '507f1f77bcf86cd799439011',
                    nodeKind: 'inputField',
                    required: true,
                },
            ],
            flowConnections: [],
        } as never);

        expect(stubValidation.validateDynamicReportFlow).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    nodeId: 'n1',
                    nodeKind: 'inputField',
                    category: 'input',
                    builderCategoryKey: 'intake',
                    nodeTypeKey: 'url-input',
                }),
            ],
            [],
            expect.any(Array),
        );
        expect(versionModel.findByIdAndUpdate).toHaveBeenCalledWith(
            '507f1f77bcf86cd799439013',
            expect.objectContaining({
                $set: expect.objectContaining({
                    flowNodes: [
                        expect.objectContaining({
                            nodeId: 'n1',
                            builderCategoryKey: 'intake',
                            nodeTypeKey: 'url-input',
                        }),
                    ],
                }),
            }),
        );
    });
});
