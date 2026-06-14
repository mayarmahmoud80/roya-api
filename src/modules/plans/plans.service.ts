import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanDocument } from './plan.schema';
import { CreatePlanDto } from './dto/create-plan.dto';

@Injectable()
export class PlansService {
    constructor(@InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>) {}

    async findAll() {
        return this.planModel
            .find({ isActive: true })
            .select('_id name price features reportLimits')
            .lean()
            .exec();
    }

    async create(dto: CreatePlanDto) {
        return this.planModel.create(dto);
    }

    async update(id: string, dto: Partial<CreatePlanDto>) {
        const plan = await this.planModel.findByIdAndUpdate(id, { $set: dto }, { new: true }).exec();
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }

    async findById(id: string) {
        const plan = await this.planModel.findById(id).exec();
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }
}
