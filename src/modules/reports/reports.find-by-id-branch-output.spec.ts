import { ReportsService } from './reports.service';
import { ReportStatus } from '../common/enums/report-status.enum';

const REPORT_ID = '507f1f77bcf86cd799439011';
const ORG_ID = '507f1f77bcf86cd799439012';

/** Mongoose-ish doc with `.populate().exec()` chain ending in `doc`. */
function reportDoc(overrides: Record<string, unknown>): Record<string, unknown> {
    const plain = {
        _id: REPORT_ID,
        status: ReportStatus.COMPLETED,
        organizationId: ORG_ID,
        data: {},
        ...overrides,
    };
    return {
        ...plain,
        toObject: () => ({ ...plain }),
    };
}

function createModel(doc: Record<string, unknown> | null) {
    return {
        findOne: jest.fn(() => ({
            populate: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(doc),
        })),
    };
}

describe('ReportsService.findById — branchResults / legacy data', () => {
    it('maps legacy Mongo `data` into a synthetic branch and omits `data` on the wire', async () => {
        const doc = reportDoc({
            data: { summary: 'Hello' },
            branchResults: [],
            reportTypeId: {},
        });
        const service = new ReportsService(createModel(doc) as never, {} as never, { add: jest.fn() } as never);

        const result = (await service.findById(ORG_ID, REPORT_ID)) as Record<string, unknown>;

        expect(result.data).toBeUndefined();
        expect(result.dataWithTypes).toBeUndefined();
        const br = result.branchResults as Array<Record<string, unknown>>;
        expect(br).toHaveLength(1);
        expect(br[0].terminalKey).toBe('__legacy_data__');
        expect(br[0].status).toBe('completed');
        expect(br[0]['data']).toEqual({ summary: 'Hello' });
    });

    it('passes stored branchResults through and strips legacy data keys only', async () => {
        const branches = [
            {
                pathId: 'path-a',
                terminalKey: 't1',
                status: 'completed',
                required: false,
                data: { brandName: 'Test' },
                completedAt: new Date(),
            },
        ];
        const plainWithoutLegacyData = {
            _id: REPORT_ID,
            status: ReportStatus.COMPLETED,
            organizationId: ORG_ID,
            branchResults: branches,
            reportTypeId: {},
        };
        const doc = {
            ...plainWithoutLegacyData,
            toObject: () => ({ ...plainWithoutLegacyData }),
        };
        const service = new ReportsService(createModel(doc) as never, {} as never, { add: jest.fn() } as never);

        const result = (await service.findById(ORG_ID, REPORT_ID)) as Record<string, unknown>;

        expect(result.data).toBeUndefined();
        expect(result.branchResults).toHaveLength(1);
        expect((result.branchResults as typeof branches)[0].data).toEqual({ brandName: 'Test' });
    });
});
