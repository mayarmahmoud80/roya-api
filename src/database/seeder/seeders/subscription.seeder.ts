import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Plan, PlanDocument } from '../../../modules/plans/plan.schema';
import { Subscription, SubscriptionDocument } from '../../../modules/subscriptions/subscription.schema';
import { PlanTier } from '../../../modules/common/enums/plan-tier.enum';
import { SubscriptionStatus } from '../../../modules/common/enums/subscription-status.enum';

@Injectable()
export class SubscriptionSeeder {
    private readonly logger = new Logger(SubscriptionSeeder.name);

    constructor(
        @InjectModel(Plan.name)
        private readonly planModel: Model<PlanDocument>,
        @InjectModel(Subscription.name)
        private readonly subscriptionModel: Model<SubscriptionDocument>,
    ) {}

    async seed(organizationId: Types.ObjectId): Promise<void> {
        const existing = await this.subscriptionModel.findOne({ organizationId }).exec();
        if (existing) {
            return;
        }
        const proPlan = await this.planModel.findOne({ tier: PlanTier.PRO }).exec();
        if (!proPlan) {
            this.logger.warn('seedDemoSubscription: Pro plan not found — run seedPlans first. Skipping.');
            return;
        }

        const now = new Date();
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + 30);

        await this.subscriptionModel.create({
            organizationId,
            planId: proPlan._id,
            status: SubscriptionStatus.TRIALING,
            startDate: now,
            trialEndsAt: trialEnd,
            autoRenew: true,
        });
        this.logger.log(`Seeded Subscription (Pro plan, trialing) for org ${String(organizationId)}`);
    }
}
