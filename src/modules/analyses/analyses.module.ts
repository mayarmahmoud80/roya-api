import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Analysis, AnalysisSchema } from './analysis.schema';
import { Report, ReportSchema } from '../reports/report.schema';
import { ReportType, ReportTypeSchema } from '../report-types/report-type.schema';
import { ReportTypeVersion, ReportTypeVersionSchema } from '../report-types/report-type-version.schema';
import { ServiceIntegration, ServiceIntegrationSchema } from '../service-integrations/service-integration.schema';
import { AnalysesService } from './analyses.service';
import { AnalysesController } from './analyses.controller';
import { DashboardController } from './dashboard.controller';
import { AnalysisProcessor } from './analysis.processor';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ServiceIntegrationsModule } from '../service-integrations/service-integrations.module';
import { OpenAIModule } from '../clients/openai/openai.module';
import { ProvidersModule } from '../providers/providers.module';
import { ReportsModule } from '../reports/reports.module';
import { ConnectionsModule } from '../connections/connections.module';
import { DynamicFlowExecutionService } from './dynamic-flow-execution.service';
import { DynamicFlowMapperService } from './dynamic-flow-mapper.service';
import { DataSource, DataSourceSchema } from '../data-sources/data-source.schema';
import {
    AiNodeExecutor,
    InputNodeExecutor,
    NodeExecutorRegistryService,
    PassthroughNodeExecutor,
    SchemaNodeExecutor,
    SourceNodeExecutor,
    TerminalNodeExecutor,
    TransformNodeExecutor,
} from './dynamic-flow-node-executors.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Analysis.name, schema: AnalysisSchema },
            { name: Report.name, schema: ReportSchema },
            { name: ReportType.name, schema: ReportTypeSchema },
            { name: ReportTypeVersion.name, schema: ReportTypeVersionSchema },
            { name: DataSource.name, schema: DataSourceSchema },
            { name: ServiceIntegration.name, schema: ServiceIntegrationSchema },
        ]),
        BullModule.registerQueue({ name: 'analysis-queue' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
        SubscriptionsModule,
        ServiceIntegrationsModule,
        ConnectionsModule,
        OpenAIModule,
        ProvidersModule,
        ReportsModule,
    ],
    providers: [
        AnalysesService,
        AnalysisProcessor,
        DynamicFlowMapperService,
        DynamicFlowExecutionService,
        InputNodeExecutor,
        SourceNodeExecutor,
        TransformNodeExecutor,
        SchemaNodeExecutor,
        AiNodeExecutor,
        TerminalNodeExecutor,
        PassthroughNodeExecutor,
        NodeExecutorRegistryService,
    ],
    controllers: [AnalysesController, DashboardController],
    exports: [AnalysesService],
})
export class AnalysesModule {}
