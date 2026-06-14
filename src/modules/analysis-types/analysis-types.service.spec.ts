import { UnprocessableEntityException } from '@nestjs/common';
import { AnalysisTypesService } from './analysis-types.service';
import { PublicationStatus } from '../common/enums/publication-status.enum';

const createModel = () => {
    const documents: Record<string, unknown>[] = [];
    return {
        documents,
        create: jest.fn(async dto => {
            const doc = {
                _id: dto._id ?? `${documents.length + 1}`.padStart(24, '0'),
                ...dto,
                save: jest.fn(async function save(this: Record<string, unknown>) {
                    return this;
                }),
            };
            documents.push(doc);
            return doc;
        }),
        find: jest.fn(() => ({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => documents),
        })),
        findOne: jest.fn((query: Record<string, unknown>) => ({
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn(async () => {
                if (query._id) return documents.find(doc => doc['_id'] === query._id) ?? null;
                if (query.slug) return documents.find(doc => doc['slug'] === query.slug) ?? null;
                if (query.key) return documents.find(doc => doc['key'] === query.key) ?? null;
                if (Array.isArray((query.$or as Record<string, unknown>[] | undefined))) {
                    return (
                        documents.find(doc =>
                            (query.$or as Record<string, unknown>[]).some(cond =>
                                Object.entries(cond).every(([k, v]) => doc[k] === v),
                            ),
                        ) ?? null
                    );
                }
                return null;
            }),
        })),
        findById: jest.fn((id: string) => ({
            exec: jest.fn(async () => documents.find(doc => doc['_id'] === id) ?? null),
        })),
        findByIdAndUpdate: jest.fn((id: string, update: { $set: Record<string, unknown> }) => ({
            exec: jest.fn(async () => {
                const doc = documents.find(item => item['_id'] === id);
                if (!doc) return null;
                Object.entries(update.$set).forEach(([key, value]) => {
                    if (value !== undefined) doc[key] = value;
                });
                return doc;
            }),
        })),
        countDocuments: jest.fn(() => ({
            exec: jest.fn(async () => documents.length),
        })),
    };
};

const createAnalysisUsageModel = () => ({
    countDocuments: jest.fn(() => ({
        exec: jest.fn(async () => 0),
    })),
});

describe('AnalysisTypesService', () => {
    it('creates analysis type drafts with ordered report refs and localized fallback', async () => {
        const analysisTypeModel = createModel();
        const analysisCategoryModel = createModel();
        await analysisCategoryModel.create({ _id: '507f1f77bcf86cd799439044', key: 'brand', slug: 'brand' });
        const service = new AnalysisTypesService(
            analysisTypeModel as never,
            createModel() as never,
            createAnalysisUsageModel() as never,
            analysisCategoryModel as never,
        );

        const created = await service.create({
            name: 'Brand Analysis',
            slug: 'brand-analysis',
            reportTypes: [
                { reportTypeId: '507f1f77bcf86cd799439012', order: 2 },
                { reportTypeId: '507f1f77bcf86cd799439011', order: 1 },
            ],
        });

        expect(created.status).toEqual(PublicationStatus.DRAFT);
        const localizedName = created.localizedName as { values: Record<string, string> };
        expect(localizedName.values['en']).toEqual('Brand Analysis');
        expect(created.reportTypes.map((ref: { order: number }) => ref.order)).toEqual([1, 2]);
    });

    it('blocks publish when attached report types are not published', async () => {
        const analysisTypeModel = createModel();
        const reportTypeModel = createModel();
        const analysisCategoryModel = createModel();
        const service = new AnalysisTypesService(
            analysisTypeModel as never,
            reportTypeModel as never,
            createAnalysisUsageModel() as never,
            analysisCategoryModel as never,
        );
        const created = await service.create({
            name: 'Brand Analysis',
            slug: 'brand-analysis',
            reportTypes: [{ reportTypeId: '507f1f77bcf86cd799439011', order: 1 }],
        });

        await expect(service.publish(String(created._id))).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('publishes when all ordered report refs point to published report types', async () => {
        const analysisTypeModel = createModel();
        const reportTypeModel = createModel();
        const analysisCategoryModel = createModel();
        const reportVersionId = '507f1f77bcf86cd799439022';
        await reportTypeModel.create({
            _id: '507f1f77bcf86cd799439011',
            status: PublicationStatus.PUBLISHED,
            currentPublishedVersionId: reportVersionId,
        });
        const service = new AnalysisTypesService(
            analysisTypeModel as never,
            reportTypeModel as never,
            createAnalysisUsageModel() as never,
            analysisCategoryModel as never,
        );
        const created = await service.create({
            name: 'Brand Analysis',
            slug: 'brand-analysis',
            reportTypes: [{ reportTypeId: '507f1f77bcf86cd799439011', reportTypeVersionId: reportVersionId, order: 1 }],
        });

        const published = await service.publish(String(created._id));

        expect(published.status).toEqual(PublicationStatus.PUBLISHED);
    });
});
