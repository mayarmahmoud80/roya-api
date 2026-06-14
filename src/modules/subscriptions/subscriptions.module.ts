import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Subscription, SubscriptionSchema } from './subscription.schema';
import { Invoice, InvoiceSchema } from '../invoices/invoice.schema';
import { Usage, UsageSchema } from '../usage/usage.schema';
import { Plan, PlanSchema } from '../plans/plan.schema';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Subscription.name, schema: SubscriptionSchema },
            { name: Invoice.name, schema: InvoiceSchema },
            { name: Usage.name, schema: UsageSchema },
            { name: Plan.name, schema: PlanSchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [SubscriptionsService],
    controllers: [SubscriptionsController],
    exports: [SubscriptionsService, MongooseModule],
})
export class SubscriptionsModule {}
