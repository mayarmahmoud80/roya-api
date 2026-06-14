import { ReportTypesController } from './report-types.controller';

describe('ReportTypesController report flow', () => {
    const service = {
        findAll: jest.fn(),
        findById: jest.fn(),
        findBySlug: jest.fn(),
        getDraftForBuilder: jest.fn(),
        getReportFlow: jest.fn(),
        saveReportFlow: jest.fn(),
        validateReportFlow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        saveDraft: jest.fn(),
        validateDraft: jest.fn(),
        publish: jest.fn(),
        archive: jest.fn(),
        preview: jest.fn(),
    };

    it('delegates get/save/validate report flow to the service', () => {
        const id = '507f1f77bcf86cd799439011';
        const c = new ReportTypesController(service as never);
        c.getReportFlow(id);
        c.saveReportFlow(id, { flowNodes: [], flowConnections: [] } as never);
        c.validateReportFlow(id, { flowNodes: [], flowConnections: [] } as never);
        expect(service.getReportFlow).toHaveBeenCalledWith(id);
        expect(service.saveReportFlow).toHaveBeenCalledWith(id, expect.any(Object));
        expect(service.validateReportFlow).toHaveBeenCalled();
    });
});
