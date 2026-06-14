import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UsageDocument = Usage & Document;

@Schema({ timestamps: true })
export class Usage {
    @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
    organizationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Subscription' })
    subscriptionId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ReportType', index: true })
    reportTypeId: Types.ObjectId;

    @Prop({ required: true, index: true })
    period: string; // "2026-03"

    @Prop({ default: 0 })
    reportCount: number;

    @Prop({ default: 0 })
    apiCallCount: number;

    @Prop({ default: 0 })
    tokensConsumed: number;
}

export const UsageSchema = SchemaFactory.createForClass(Usage);
UsageSchema.index({ organizationId: 1, reportTypeId: 1, period: 1 }, { unique: true });
