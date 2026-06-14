import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subscription, SubscriptionDocument } from './subscription.schema';
import { Invoice, InvoiceDocument } from '../invoices/invoice.schema';
import { Usage, UsageDocument } from '../usage/usage.schema';
import { Plan, PlanDocument } from '../plans/plan.schema';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';
import { UpgradeSubscriptionDto } from './dto/upgrade.dto';

@Injectable()
export class SubscriptionsService {
    constructor(
        @InjectModel(Subscription.name) private readonly subModel: Model<SubscriptionDocument>,
        @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
        @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Usage.name) private readonly usageModel: Model<UsageDocument>,
    ) {}

    async getMySubscription(organizationId: string) {
        const sub = await this.subModel
            .findOne({ organizationId: new Types.ObjectId(organizationId) })
            .populate('planId', '_id name price features reportLimits')
            .sort({ createdAt: -1 })
            .lean()
            .exec();
        if (!sub) throw new NotFoundException('No subscription found');
        return sub;
    }

    async upgrade(organizationId: string, dto: UpgradeSubscriptionDto) {
        const plan = await this.planModel.findById(dto.planId).exec();
        if (!plan) throw new NotFoundException('Plan not found');

        const sub = await this.subModel.findOneAndUpdate(
            { organizationId: new Types.ObjectId(organizationId), status: { $ne: SubscriptionStatus.CANCELLED } },
            {
                planId: new Types.ObjectId(dto.planId),
                status: SubscriptionStatus.ACTIVE,
                startDate: new Date(),
            },
            { new: true, upsert: true },
        )
            .populate('planId', '_id name price features reportLimits')
            .lean()
            .exec();

        return sub;
    }

    async cancel(organizationId: string) {
        const sub = await this.subModel.findOneAndUpdate(
            { organizationId: new Types.ObjectId(organizationId) },
            { status: SubscriptionStatus.CANCELLED, autoRenew: false },
            { new: true },
        ).exec();
        if (!sub) throw new NotFoundException('No subscription found');
        return sub;
    }

    async getInvoices(organizationId: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.invoiceModel.find({ organizationId: new Types.ObjectId(organizationId) })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.invoiceModel.countDocuments({ organizationId: new Types.ObjectId(organizationId) }),
        ]);
        return { items, total, page, limit };
    }

    async getInvoiceById(organizationId: string, id: string) {
        const invoice = await this.invoiceModel.findOne({
            _id: new Types.ObjectId(id),
            organizationId: new Types.ObjectId(organizationId),
        }).exec();
        if (!invoice) throw new NotFoundException('Invoice not found');
        return invoice;
    }

    async getCurrentUsage(organizationId: string) {
        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return this.usageModel
            .find({
                organizationId: new Types.ObjectId(organizationId),
                period,
            })
            .select('reportTypeId reportCount period')
            .populate('reportTypeId', '_id name slug')
            .lean()
            .exec();
    }

    async getUsageHistory(organizationId: string, months = 6) {
        const periods: string[] = [];
        const now = new Date();
        for (let i = 0; i < months; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return this.usageModel
            .find({
                organizationId: new Types.ObjectId(organizationId),
                period: { $in: periods },
            })
            .select('reportTypeId reportCount period')
            .populate('reportTypeId', '_id name slug')
            .lean()
            .exec();
    }

    async checkAndIncrement(organizationId: string, reportTypeId: string, reportTypeSlug: string) {
        const sub = await this.subModel
            .findOne({
                organizationId: new Types.ObjectId(organizationId),
                status: SubscriptionStatus.ACTIVE,
            })
            .populate('planId')
            .exec();

        if (!sub) throw new NotFoundException('No active subscription');

        const plan = sub.planId as any;
        const limit = plan?.reportLimits?.get ? plan.reportLimits.get(reportTypeSlug) : undefined;

        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const usage = await this.usageModel.findOne({
            organizationId: new Types.ObjectId(organizationId),
            reportTypeId: new Types.ObjectId(reportTypeId),
            period,
        }).exec();

        if (limit !== undefined && limit !== -1 && usage && usage.reportCount >= limit) {
            const { ForbiddenException } = await import('@nestjs/common');
            throw new ForbiddenException(`Monthly limit reached for this report type (${limit})`);
        }

        await this.usageModel.findOneAndUpdate(
            {
                organizationId: new Types.ObjectId(organizationId),
                reportTypeId: new Types.ObjectId(reportTypeId),
                period,
            },
            {
                $inc: { reportCount: 1 },
                $setOnInsert: {
                    organizationId: new Types.ObjectId(organizationId),
                    reportTypeId: new Types.ObjectId(reportTypeId),
                    period,
                    subscriptionId: sub._id,
                },
            },
            { upsert: true, new: true },
        ).exec();
    }
}
