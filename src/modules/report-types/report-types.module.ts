import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReportType, ReportTypeSchema } from './report-type.schema';
import { ReportTypeVersion, ReportTypeVersionSchema } from './report-type-version.schema';
import { BuilderAsset, BuilderAssetSchema } from '../builder-assets/schemas/builder-asset.schema';
import { BuilderCategory, BuilderCategorySchema } from '../builder-categories/builder-category.schema';
import { DataSource, DataSourceSchema } from '../data-sources/data-source.schema';
import { AnalysisType, AnalysisTypeSchema } from '../analysis-types/analysis-type.schema';
import { NodeType, NodeTypeSchema } from '../node-types/node-type.schema';
import { ReportTypeBuilderValidationService } from './report-type-builder-validation.service';
import { ReportTypesService } from './report-types.service';
import { ReportTypesController } from './report-types.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ReportType.name, schema: ReportTypeSchema },
            { name: ReportTypeVersion.name, schema: ReportTypeVersionSchema },
            { name: BuilderAsset.name, schema: BuilderAssetSchema },
            { name: BuilderCategory.name, schema: BuilderCategorySchema },
            { name: NodeType.name, schema: NodeTypeSchema },
            { name: DataSource.name, schema: DataSourceSchema },
            { name: AnalysisType.name, schema: AnalysisTypeSchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [ReportTypesService, ReportTypeBuilderValidationService],
    controllers: [ReportTypesController],
    exports: [ReportTypesService, MongooseModule],
})
export class ReportTypesModule {}
