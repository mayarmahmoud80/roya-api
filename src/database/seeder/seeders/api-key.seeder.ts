import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { APIKey, APIKeyDocument } from '../../../modules/api-keys/api-key.schema';
import { APIKeyStatus } from '../../../modules/common/enums/api-key-status.enum';

@Injectable()
export class ApiKeySeeder {
    private readonly logger = new Logger(ApiKeySeeder.name);

    constructor(
        @InjectModel(APIKey.name)
        private readonly apiKeyModel: Model<APIKeyDocument>,
    ) {}

    async seed(organizationId: Types.ObjectId): Promise<void> {
        const existing = await this.apiKeyModel.findOne({ organizationId, name: 'Demo API Key' }).exec();
        if (existing) {
            return;
        }

        const rawKey = `roya_${crypto.randomBytes(24).toString('hex')}`;
        const keyPrefix = rawKey.slice(0, 12);
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        await this.apiKeyModel.create({
            organizationId,
            name: 'Demo API Key',
            keyPrefix,
            keyHash,
            status: APIKeyStatus.ACTIVE,
            rateLimit: 120,
        });

        this.logger.log('Seeded APIKey — copy this NOW (only shown once):');
        this.logger.log(`    ${rawKey}`);
    }
}
