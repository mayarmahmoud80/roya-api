import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Analysis, AnalysisSchema } from '../analyses/analysis.schema';
import { Report, ReportSchema } from './report.schema';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Report.name, schema: ReportSchema },
            { name: Analysis.name, schema: AnalysisSchema },
        ]),
        BullModule.registerQueue({ name: 'analysis-queue' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [ReportsService],
    controllers: [ReportsController],
    exports: [ReportsService, MongooseModule],
})
export class ReportsModule {}
