import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { SeederService } from './seeder.service';
import { Plan, PlanSchema } from '../../modules/plans/plan.schema';
import { AnalysisType, AnalysisTypeSchema } from '../../modules/analysis-types/analysis-type.schema';
import { ReportType, ReportTypeSchema } from '../../modules/report-types/report-type.schema';
import { ReportTypeVersion, ReportTypeVersionSchema } from '../../modules/report-types/report-type-version.schema';
import { DataSource, DataSourceSchema } from '../../modules/data-sources/data-source.schema';
import { BuilderAsset, BuilderAssetSchema } from '../../modules/builder-assets/schemas/builder-asset.schema';
import { AnalysisCategoryEntity, AnalysisCategorySchema } from '../../modules/analysis-categories/analysis-category.schema';
import { BuilderCategory, BuilderCategorySchema } from '../../modules/builder-categories/builder-category.schema';
import { NodeType, NodeTypeSchema } from '../../modules/node-types/node-type.schema';
import { User, userSchema } from '../../modules/common/user/model/user.schema';
import { Organization, OrganizationSchema } from '../../modules/organizations/organization.schema';
import { Subscription, SubscriptionSchema } from '../../modules/subscriptions/subscription.schema';
import { APIKey, APIKeySchema } from '../../modules/api-keys/api-key.schema';

import { AnalysisCategoriesSeeder } from './seeders/analysis-categories.seeder';
import { BuilderCategoriesSeeder } from './seeders/builder-categories.seeder';
import { NodeTypesSeeder } from './seeders/node-types.seeder';
import { DataSourcesSeeder } from './seeders/data-sources.seeder';
import { ProviderCatalogSeeder } from './seeders/provider-catalog.seeder';
import { PlansSeeder } from './seeders/plans.seeder';
import { ReportTypesSeeder } from './seeders/report-types.seeder';
import { BuilderAssetsSeeder } from './seeders/builder-assets.seeder';
import { NodeDefinitionPatchSeeder } from './seeders/node-definition-patch.seeder';
import { BuilderSampleFlowSeeder } from './seeders/builder-sample-flow.seeder';
import { DynamicExamplesSeeder } from './seeders/dynamic-examples.seeder';
import { TenantsSeeder } from './seeders/tenants.seeder';
import { SubscriptionSeeder } from './seeders/subscription.seeder';
import { ApiKeySeeder } from './seeders/api-key.seeder';
import { ProvidersCatalogBuilderSeeder } from './seeders/providers-catalog-builder.seeder';
import { EncryptionService } from '../../modules/common/services/encryption.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
        MongooseModule.forFeature([
            { name: Plan.name, schema: PlanSchema },
            { name: AnalysisType.name, schema: AnalysisTypeSchema },
            { name: ReportType.name, schema: ReportTypeSchema },
            { name: ReportTypeVersion.name, schema: ReportTypeVersionSchema },
            { name: DataSource.name, schema: DataSourceSchema },
            { name: BuilderAsset.name, schema: BuilderAssetSchema },
            { name: AnalysisCategoryEntity.name, schema: AnalysisCategorySchema },
            { name: BuilderCategory.name, schema: BuilderCategorySchema },
            { name: NodeType.name, schema: NodeTypeSchema },
            { name: User.name, schema: userSchema },
            { name: Organization.name, schema: OrganizationSchema },
            { name: Subscription.name, schema: SubscriptionSchema },
            { name: APIKey.name, schema: APIKeySchema },
        ]),
    ],
    providers: [
        EncryptionService,
        SeederService,
        AnalysisCategoriesSeeder,
        BuilderCategoriesSeeder,
        NodeTypesSeeder,
        ProviderCatalogSeeder,
        DataSourcesSeeder,
        PlansSeeder,
        ReportTypesSeeder,
        BuilderAssetsSeeder,
        NodeDefinitionPatchSeeder,
        BuilderSampleFlowSeeder,
        DynamicExamplesSeeder,
        TenantsSeeder,
        SubscriptionSeeder,
        ApiKeySeeder,
        ProvidersCatalogBuilderSeeder,
    ],
    exports: [SeederService],
})
export class SeederModule {}
