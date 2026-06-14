import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';

import { RoyaAuthModule } from './common/auth/roya-auth.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AnalysisTypesModule } from './analysis-types/analysis-types.module';
import { AnalysisCategoriesModule } from './analysis-categories/analysis-categories.module';
import { ReportTypesModule } from './report-types/report-types.module';
import { BuilderAssetsModule } from './builder-assets/builder-assets.module';
import { BuilderCategoriesModule } from './builder-categories/builder-categories.module';
import { NodeTypesModule } from './node-types/node-types.module';
import { DataSourcesModule } from './data-sources/data-sources.module';
import { ProvidersCatalogModule } from './providers-catalog/providers-catalog.module';
import { ServiceIntegrationsModule } from './service-integrations/service-integrations.module';
import { AnalysesModule } from './analyses/analyses.module';
import { ReportsModule } from './reports/reports.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { StandaloneApiModule } from './standalone-api/standalone-api.module';
import { OpenAIModule } from './clients/openai/openai.module';
import { SemrushModule } from './clients/semrush/semrush.module';
import { ScraperModule } from './clients/scraper/scraper.module';
import { StripeModule } from './clients/stripe/stripe.module';
import { StripeWebhooksController } from './clients/stripe/stripe-webhooks.controller';
import { SeederModule } from '../database/seeder/seeder.module';
import { Subscription, SubscriptionSchema } from './subscriptions/subscription.schema';
import { Invoice, InvoiceSchema } from './invoices/invoice.schema';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                uri: config.get<string>('DATABASE_URL'),
            }),
            inject: [ConfigService],
        }),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                redis: {
                    host: config.get<string>('REDIS_HOST') || 'localhost',
                    port: config.get<number>('REDIS_PORT') || 6379,
                    password: config.get<string>('REDIS_PASSWORD') || undefined,
                },
            }),
            inject: [ConfigService],
        }),
        MongooseModule.forFeature([
            { name: Subscription.name, schema: SubscriptionSchema },
            { name: Invoice.name, schema: InvoiceSchema },
        ]),
        RoyaAuthModule,
        AuthModule,
        OrganizationsModule,
        PlansModule,
        SubscriptionsModule,
        AnalysisCategoriesModule,
        AnalysisTypesModule,
        BuilderCategoriesModule,
        NodeTypesModule,
        ReportTypesModule,
        BuilderAssetsModule,
        DataSourcesModule,
        ProvidersCatalogModule,
        ServiceIntegrationsModule,
        AnalysesModule,
        ReportsModule,
        ApiKeysModule,
        StandaloneApiModule,
        OpenAIModule,
        SemrushModule,
        ScraperModule,
        StripeModule,
        SeederModule,
    ],
    controllers: [StripeWebhooksController],
})
export class RoyaAppModule {}
