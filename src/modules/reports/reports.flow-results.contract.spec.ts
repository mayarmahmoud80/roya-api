import { ReportsController } from './reports.controller';

describe('ReportsController flow results', () => {
    const analysisId = '507f1f77bcf86cd799439022';

    it('delegates getFlowResults to the service with organization id and report id', () => {
        const service = {
            getFlowResults: jest.fn(),
            findAnalysisOverview: jest.fn(),
            findById: jest.fn(),
            regenerate: jest.fn(),
        };
        // @ts-expect-error partial mock
        const c = new ReportsController(service);
        const req = { embed: undefined };
        c.getFlowResults('org-1', '507f1f77bcf86cd799439011', req);
        expect(service.getFlowResults).toHaveBeenCalledWith('org-1', '507f1f77bcf86cd799439011');
    });

    it('delegates getAnalysisOverview with org id and embed-scoped analysis id', () => {
        const service = {
            getFlowResults: jest.fn(),
            findAnalysisOverview: jest.fn(),
            findById: jest.fn(),
            regenerate: jest.fn(),
        };
        // @ts-expect-error partial mock
        const c = new ReportsController(service);
        const req = { embed: { analysisId } };
        c.getAnalysisOverview('org-1', analysisId, req);
        expect(service.findAnalysisOverview).toHaveBeenCalledWith('org-1', analysisId);
    });
});
