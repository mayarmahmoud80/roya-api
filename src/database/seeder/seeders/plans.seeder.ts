import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanDocument } from '../../../modules/plans/plan.schema';
import plansData from '../data/plans.json';

@Injectable()
export class PlansSeeder {
    private readonly logger = new Logger(PlansSeeder.name);

    constructor(
        @InjectModel(Plan.name)
        private readonly planModel: Model<PlanDocument>,
    ) {}

    async seed(): Promise<void> {
        const count = await this.planModel.countDocuments();
        if (count > 0) return;

        // Convert reportLimits from plain object to Map
        const plans = plansData.map(plan => ({
            ...plan,
            reportLimits: new Map(Object.entries(plan.reportLimits)),
        }));

        await this.planModel.insertMany(plans);
        this.logger.log('Seeded Plans');
    }
}
