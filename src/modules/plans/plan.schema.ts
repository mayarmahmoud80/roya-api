import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PlanTier } from '../common/enums/plan-tier.enum';
import { BillingCycle } from '../common/enums/billing-cycle.enum';

export type PlanDocument = Plan & Document;

@Schema({ timestamps: true })
export class Plan {
    @Prop({ required: true })
    name: string;

    @Prop({ enum: Object.values(PlanTier), required: true })
    tier: PlanTier;

    @Prop({ default: 0 })
    price: number;

    @Prop({ enum: Object.values(BillingCycle), default: BillingCycle.MONTHLY })
    billingCycle: BillingCycle;

    @Prop({ type: Map, of: Number, default: {} })
    reportLimits: Map<string, number>;

    @Prop({ default: false })
    apiAccessEnabled: boolean;

    @Prop({ default: 3 })
    maxUsers: number;

    @Prop({ type: [String], default: [] })
    features: string[];

    @Prop({ default: true })
    isActive: boolean;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
