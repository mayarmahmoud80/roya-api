import { AnalysisTypesController } from './analysis-types.controller';

describe('AnalysisTypesController contract', () => {
    const service = {
        findAll: jest.fn(),
        findById: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        publish: jest.fn(),
        unpublish: jest.fn(),
        remove: jest.fn(),
    };

    it('delegates list, detail, create, update, publish, unpublish, and delete calls to service', () => {
        const controller = new AnalysisTypesController(service as never);
        const id = '507f1f77bcf86cd799439011';

        controller.findAll({ page: 1, limit: 25 });
        controller.findById(id);
        controller.create({ name: 'Brand Analysis', slug: 'brand-analysis' });
        controller.update(id, { name: 'Brand' });
        controller.publish(id);
        controller.unpublish(id);
        controller.remove(id);

        expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 25 });
        expect(service.findById).toHaveBeenCalledWith(id);
        expect(service.create).toHaveBeenCalled();
        expect(service.update).toHaveBeenCalledWith(id, { name: 'Brand' });
        expect(service.publish).toHaveBeenCalledWith(id);
        expect(service.unpublish).toHaveBeenCalledWith(id);
        expect(service.remove).toHaveBeenCalledWith(id);
    });
});
