import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { User, userSchema } from '../user/model/user.schema';
import { Organization, OrganizationSchema } from '../../organizations/organization.schema';
import { Subscription, SubscriptionSchema } from '../../subscriptions/subscription.schema';
import { Plan, PlanSchema } from '../../plans/plan.schema';

import { RoyaAuthService } from './service/roya-auth.service';
import { RoyaAuthController } from './controller/roya-auth.controller';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: userSchema },
            { name: Organization.name, schema: OrganizationSchema },
            { name: Subscription.name, schema: SubscriptionSchema },
            { name: Plan.name, schema: PlanSchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') || '7d') as any },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [RoyaAuthService, JwtAuthGuard],
    controllers: [RoyaAuthController],
    exports: [RoyaAuthService, JwtAuthGuard, MongooseModule],
})
export class RoyaAuthModule {}
