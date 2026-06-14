import { ReportTypesController } from './report-types.controller';

describe('ReportTypesController contract', () => {
    const service = {
        findAll: jest.fn(),
        findPublishedLiteList: jest.fn(),
        findById: jest.fn(),
        findBySlug: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        getReportFlow: jest.fn(),
        saveReportFlow: jest.fn(),
        validateReportFlow: jest.fn(),
        publish: jest.fn(),
        archive: jest.fn(),
    };

    it('delegates list, create, and flow endpoints to the service', () => {
        const controller = new ReportTypesController(service as never);

        controller.findAll({ page: 1, limit: 25 });
        controller.findPublishedLite();
        controller.create({
            localizedName: { defaultLanguage: 'en', values: { en: 'Brand Overview' } },
            slug: 'brand-overview',
        } as never);
        controller.saveReportFlow('507f1f77bcf86cd799439011', {
            flowNodes: [],
            flowConnections: [],
        } as never);
        controller.getReportFlow('507f1f77bcf86cd799439011');

        expect(service.findAll).toHaveBeenCalled();
        expect(service.findPublishedLiteList).toHaveBeenCalled();
        expect(service.create).toHaveBeenCalled();
        expect(service.saveReportFlow).toHaveBeenCalledWith('507f1f77bcf86cd799439011', expect.any(Object));
        expect(service.getReportFlow).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
});
