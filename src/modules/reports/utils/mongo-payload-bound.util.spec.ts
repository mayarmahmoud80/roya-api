import { BSON } from 'bson';
import { truncateDeepStrings, truncateMongoFlowProbeUntilFits } from './mongo-payload-bound.util';

describe('mongo-payload-bound.util', () => {
    it('truncateMongoFlowProbeUntilFits keeps large nested strings under BSON size cap', () => {
        const huge = 'x'.repeat(8_500_000);
        const probe = {
            status: 'COMPLETED',
            branchResults: [{ pathId: 'p', terminalKey: 't', status: 'completed', required: false, data: { x: huge } }],
            __executionTry: {
                trigger: 'initial',
                status: 'completed',
                startedAt: new Date('2026-04-01T00:00:00.000Z'),
                finishedAt: new Date('2026-04-01T00:00:01.000Z'),
                durationMs: 1000,
                nodes: [{ nodeId: 'n1', status: 'completed', outputs: { html: huge } }],
            },
        };
        expect(BSON.calculateObjectSize(probe as unknown as Record<string, unknown>) > 12 * 1024 * 1024).toBe(true);

        const fitted = truncateMongoFlowProbeUntilFits(probe as Record<string, unknown>);
        const size = BSON.calculateObjectSize(fitted);
        expect(size <= 12 * 1024 * 1024).toBe(true);
        const row = (fitted.branchResults as Array<{ data: { x: string } }>)[0];
        expect(row.data.x.length).toBeLessThan(huge.length);
    });

    it('truncateDeepStrings trims long strings with notice', () => {
        expect((truncateDeepStrings('ab'.repeat(50), 80) as string).includes('truncated')).toBe(true);
    });
});
