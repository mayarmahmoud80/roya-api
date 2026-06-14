import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { APIKeyStatus } from '../common/enums/api-key-status.enum';

export type APIKeyDocument = APIKey & Document;

@Schema({ timestamps: true })
export class APIKey {
    @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
    organizationId: Types.ObjectId;

    @Prop({ type: [Types.ObjectId], ref: 'ReportType' })
    reportTypeIds: Types.ObjectId[];

    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    keyPrefix: string;

    @Prop({ required: true, index: true })
    keyHash: string;

    @Prop({ enum: Object.values(APIKeyStatus), default: APIKeyStatus.ACTIVE })
    status: APIKeyStatus;

    @Prop({ default: 60 })
    rateLimit: number;

    @Prop()
    expiresAt: Date;

    @Prop()
    lastUsedAt: Date;
}

export const APIKeySchema = SchemaFactory.createForClass(APIKey);
APIKeySchema.index({ keyHash: 1 }, { unique: true });
