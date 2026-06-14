import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ServiceIntegration, ServiceIntegrationDocument } from './service-integration.schema';
import { EncryptionService } from '../common/services/encryption.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { IntegrationStatus } from '../common/enums/integration-status.enum';

@Injectable()
export class ServiceIntegrationsService {
    constructor(
        @InjectModel(ServiceIntegration.name) private readonly model: Model<ServiceIntegrationDocument>,
        private readonly encryptionService: EncryptionService,
    ) {}

    findAll(organizationId: string) {
        return this.model
            .find({ organizationId: new Types.ObjectId(organizationId) })
            .select('_id dataSourceId status')
            .lean()
            .exec();
    }

    async findById(organizationId: string, id: string) {
        const item = await this.model
            .findOne({
                _id: new Types.ObjectId(id),
                organizationId: new Types.ObjectId(organizationId),
            })
            .populate('dataSourceId')
            .exec();
        if (!item) throw new NotFoundException('Integration not found');
        return item;
    }

    async create(organizationId: string, dto: CreateIntegrationDto) {
        const data: any = {
            organizationId: new Types.ObjectId(organizationId),
            dataSourceId: new Types.ObjectId(dto.dataSourceId),
            config: dto.config || {},
            status: IntegrationStatus.ACTIVE,
        };

        if (dto.apiKey) {
            data.encryptedApiKey = this.encryptionService.encrypt(dto.apiKey);
        }

        return this.model.create(data);
    }

    async update(organizationId: string, id: string, dto: Partial<CreateIntegrationDto>) {
        const update: any = {};
        if (dto.apiKey) update.encryptedApiKey = this.encryptionService.encrypt(dto.apiKey);
        if (dto.config) update.config = dto.config;

        const item = await this.model.findOneAndUpdate(
            { _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) },
            { $set: update },
            { new: true },
        ).exec();
        if (!item) throw new NotFoundException('Integration not found');
        return item;
    }

    async remove(organizationId: string, id: string) {
        const item = await this.model.findOneAndDelete({
            _id: new Types.ObjectId(id),
            organizationId: new Types.ObjectId(organizationId),
        }).exec();
        if (!item) throw new NotFoundException('Integration not found');
        return { deleted: true };
    }

    async findByDataSourceProvider(organizationId: string, provider: string) {
        const integrations = await this.model
            .find({ organizationId: new Types.ObjectId(organizationId) })
            .populate('dataSourceId')
            .exec();

        return integrations.find((i: any) => i.dataSourceId?.provider === provider);
    }

    decryptKey(integration: ServiceIntegrationDocument): string | null {
        if (!integration.encryptedApiKey) return null;
        return this.encryptionService.decrypt(integration.encryptedApiKey);
    }
}
