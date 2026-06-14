import { BuilderAssetsController } from './builder-assets.controller';

describe('BuilderAssetsController node definitions', () => {
    const service = {
        listNodeDefinitions: jest.fn(),
        createNodeDefinition: jest.fn(),
        getNodeDefinition: jest.fn(),
        updateNodeDefinition: jest.fn(),
        uploadBrandingImage: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        usage: jest.fn(),
        listNodePaletteCategories: jest.fn(),
    };

    it('delegates node definition list and create to the service', () => {
        const controller = new BuilderAssetsController(service as never);
        controller.listNodePaletteCategories();
        controller.listNodeDefinitions({ page: 1, limit: 20, includeInactive: true } as never);
        controller.createNodeDefinition({ slug: 'nd-test' } as never);
        controller.getNodeDefinition('507f1f77bcf86cd799439011');
        controller.updateNodeDefinition('507f1f77bcf86cd799439011', { status: 'inactive' } as never);
        expect(service.listNodePaletteCategories).toHaveBeenCalled();
        expect(service.listNodeDefinitions).toHaveBeenCalledWith(
            expect.objectContaining({ page: 1, limit: 20, includeInactive: true }),
        );
        expect(service.createNodeDefinition).toHaveBeenCalled();
        expect(service.getNodeDefinition).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
        expect(service.updateNodeDefinition).toHaveBeenCalled();
    });
});
