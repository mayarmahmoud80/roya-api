import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { APIKey, APIKeyDocument } from './api-key.schema';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { APIKeyStatus } from '../common/enums/api-key-status.enum';

@Injectable()
export class ApiKeysService {
    constructor(@InjectModel(APIKey.name) private readonly model: Model<APIKeyDocument>) {}

    findAll(organizationId: string) {
        return this.model
            .find({ organizationId: new Types.ObjectId(organizationId) })
            .select('_id name keyPrefix rateLimit status lastUsedAt')
            .lean()
            .exec();
    }

    async create(organizationId: string, dto: CreateApiKeyDto) {
        const rawKey = 'rp_sk_' + crypto.randomBytes(32).toString('hex');
        const keyPrefix = rawKey.substring(0, 12);
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        const apiKey = await this.model.create({
            organizationId: new Types.ObjectId(organizationId),
            reportTypeIds: dto.reportTypeIds.map(id => new Types.ObjectId(id)),
            name: dto.name,
            keyPrefix,
            keyHash,
            status: APIKeyStatus.ACTIVE,
            rateLimit: dto.rateLimit || 60,
            expiresAt: dto.expiresAt,
        });

        return { ...apiKey.toObject(), rawKey };
    }

    async revoke(organizationId: string, id: string) {
        const apiKey = await this.model.findOneAndUpdate(
            { _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) },
            { status: APIKeyStatus.REVOKED },
            { new: true },
        ).exec();

        if (!apiKey) throw new NotFoundException('API key not found');
        return apiKey;
    }

    async validateKey(rawKey: string): Promise<APIKeyDocument> {
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const apiKey = await this.model.findOne({ keyHash }).populate('reportTypeIds').exec();

        if (!apiKey) throw new UnauthorizedException('Invalid API key');
        if (apiKey.status !== APIKeyStatus.ACTIVE) throw new UnauthorizedException('API key is revoked');
        if (apiKey.expiresAt && new Date() > apiKey.expiresAt) throw new UnauthorizedException('API key has expired');

        await this.model.findByIdAndUpdate(apiKey._id, { lastUsedAt: new Date() });
        return apiKey;
    }
}
