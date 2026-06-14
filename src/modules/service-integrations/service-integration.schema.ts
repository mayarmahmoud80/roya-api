import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IntegrationStatus } from '../common/enums/integration-status.enum';

export type ServiceIntegrationDocument = ServiceIntegration & Document;

@Schema({ timestamps: true })
export class ServiceIntegration {
    @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
    organizationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'DataSource' })
    dataSourceId: Types.ObjectId;

    @Prop()
    encryptedApiKey: string;

    @Prop()
    oauthToken: string;

    @Prop({ type: Object, default: {} })
    config: Record<string, any>;

    @Prop({ enum: Object.values(IntegrationStatus), default: IntegrationStatus.INACTIVE })
    status: IntegrationStatus;

    @Prop()
    lastUsedAt: Date;

    @Prop()
    lastErrorAt: Date;
}

export const ServiceIntegrationSchema = SchemaFactory.createForClass(ServiceIntegration);
