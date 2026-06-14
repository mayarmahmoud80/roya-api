import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';

export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true })
export class Subscription {
    @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
    organizationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Plan', required: true })
    planId: Types.ObjectId;

    @Prop({ enum: Object.values(SubscriptionStatus), default: SubscriptionStatus.TRIALING })
    status: SubscriptionStatus;

    @Prop({ required: true })
    startDate: Date;

    @Prop()
    endDate: Date;

    @Prop()
    trialEndsAt: Date;

    @Prop({ default: true })
    autoRenew: boolean;

    @Prop()
    externalSubId: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
