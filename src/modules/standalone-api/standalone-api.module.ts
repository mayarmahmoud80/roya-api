import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { StandaloneApiController } from './standalone-api.controller';
import { Analysis, AnalysisSchema } from '../analyses/analysis.schema';
import { Report, ReportSchema } from '../reports/report.schema';
import { ReportType, ReportTypeSchema } from '../report-types/report-type.schema';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Analysis.name, schema: AnalysisSchema },
            { name: Report.name, schema: ReportSchema },
            { name: ReportType.name, schema: ReportTypeSchema },
        ]),
        BullModule.registerQueue({ name: 'analysis-queue' }),
        ApiKeysModule,
    ],
    controllers: [StandaloneApiController],
})
export class StandaloneApiModule {}
