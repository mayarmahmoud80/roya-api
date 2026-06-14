import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportStatus } from '../common/enums/report-status.enum';

const createModel = () => {
    const documents: Record<string, unknown>[] = [];
    return {
        documents,
        findByIdAndUpdate: jest.fn(
            (id: string, update: { $set: Record<string, unknown>; $unset?: Record<string, number> }) => ({
                exec: jest.fn(async () => {
                    const doc = documents.find(item => item['_id'] === id);
                    if (!doc) return null;
                    if (update.$set) Object.assign(doc, update.$set);
                    if (update.$unset) {
                        for (const k of Object.keys(update.$unset)) {
                            delete doc[k];
                        }
                    }
                    return doc;
                }),
            }),
        ),
        findOne: jest.fn(),
    };
};

describe('ReportsService partial output', () => {
    it('preserves completed data with retryable failed part markers', async () => {
        const model = createModel();
        model.documents.push({ _id: '507f1f77bcf86cd799439011' });
        const service = new ReportsService(model as never, {} as never, { add: jest.fn() } as never);

        const report = await service.preservePartialOutput(
            '507f1f77bcf86cd799439011',
            { summary: 'Ready' },
            [{ key: 'logoUrl', provider: 'logo-picker', message: 'Provider timeout', retryable: true }],
        );

        expect(report.status).toEqual(ReportStatus.FAILED);
        const branches = report.branchResults as Array<Record<string, unknown>>;
        expect(branches?.[0]?.['data']).toEqual({ summary: 'Ready' });
        expect((report as { data?: unknown }).data).toBeUndefined();
        expect(report.failedParts).toEqual([expect.objectContaining({ key: 'logoUrl', retryable: true })]);
        expect(report.retryMetadata).toEqual(expect.objectContaining({ retryablePartCount: 1 }));
    });

    it('marks reports completed when no parts failed', async () => {
        const model = createModel();
        model.documents.push({ _id: '507f1f77bcf86cd799439011' });
        const service = new ReportsService(model as never, {} as never, { add: jest.fn() } as never);

        const report = await service.preservePartialOutput('507f1f77bcf86cd799439011', { summary: 'Ready' }, []);

        expect(report.status).toEqual(ReportStatus.COMPLETED);
        expect(report.failedParts).toEqual([]);
        const branches = report.branchResults as Array<Record<string, unknown>>;
        expect(branches?.[0]?.['data']).toEqual({ summary: 'Ready' });
    });

    it('throws when preserving output for a missing report', async () => {
        const service = new ReportsService(createModel() as never, {} as never, { add: jest.fn() } as never);

        await expect(service.preservePartialOutput('missing', {}, [])).rejects.toBeInstanceOf(NotFoundException);
    });
});
