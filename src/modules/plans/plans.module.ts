import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Plan, PlanSchema } from './plan.schema';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Plan.name, schema: PlanSchema }]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [PlansService],
    controllers: [PlansController],
    exports: [PlansService, MongooseModule],
})
export class PlansModule {}
