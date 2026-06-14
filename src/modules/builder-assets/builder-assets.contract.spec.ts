jest.mock('../integrations/s3/s3.service', () => ({
    S3Service: jest.fn().mockImplementation(() => ({
        uploadFile: jest.fn().mockResolvedValue({ url: 'https://example.com/x.png', key: 'k', bucket: 'b' }),
    })),
}));

import { BuilderAssetsController } from './builder-assets.controller';

describe('BuilderAssetsController contract', () => {
    const service = {
        findAll: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        usage: jest.fn(),
    };

    it('delegates list, create, update, and usage calls to service', () => {
        const controller = new BuilderAssetsController(service as never);

        controller.findAll({ page: 1, limit: 25 });
        controller.create({ slug: 'text' } as never);
        controller.update('507f1f77bcf86cd799439011', { slug: 'text' } as never);
        controller.usage('507f1f77bcf86cd799439011');

        expect(service.findAll).toHaveBeenCalled();
        expect(service.create).toHaveBeenCalled();
        expect(service.update).toHaveBeenCalled();
        expect(service.usage).toHaveBeenCalled();
    });
});

