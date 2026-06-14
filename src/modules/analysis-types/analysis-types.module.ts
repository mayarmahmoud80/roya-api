import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AnalysisType, AnalysisTypeSchema } from './analysis-type.schema';
import { AnalysisTypesService } from './analysis-types.service';
import { AnalysisTypesController } from './analysis-types.controller';
import { ReportType, ReportTypeSchema } from '../report-types/report-type.schema';
import { Analysis, AnalysisSchema } from '../analyses/analysis.schema';
import { AnalysisCategoryEntity, AnalysisCategorySchema } from '../analysis-categories/analysis-category.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: AnalysisType.name, schema: AnalysisTypeSchema },
            { name: ReportType.name, schema: ReportTypeSchema },
            { name: Analysis.name, schema: AnalysisSchema },
            { name: AnalysisCategoryEntity.name, schema: AnalysisCategorySchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [AnalysisTypesService],
    controllers: [AnalysisTypesController],
    exports: [AnalysisTypesService, MongooseModule],
})
export class AnalysisTypesModule {}
