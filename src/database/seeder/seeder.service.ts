import { Injectable, Logger } from '@nestjs/common';
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

/**
 * Thin orchestrator that delegates to per-entity seed services.
 * Preserves the original seeding order for dependency correctness.
 */
@Injectable()
export class SeederService {
    private readonly logger = new Logger(SeederService.name);

    constructor(
        private readonly providerCatalogSeeder: ProviderCatalogSeeder,
        private readonly dataSourcesSeeder: DataSourcesSeeder,
        private readonly builderAssetsSeeder: BuilderAssetsSeeder,
        private readonly analysisCategoriesSeeder: AnalysisCategoriesSeeder,
        private readonly builderCategoriesSeeder: BuilderCategoriesSeeder,
        private readonly nodeTypesSeeder: NodeTypesSeeder,
        private readonly nodeDefinitionPatchSeeder: NodeDefinitionPatchSeeder,
        private readonly reportTypesSeeder: ReportTypesSeeder,
        private readonly plansSeeder: PlansSeeder,
        private readonly builderSampleFlowSeeder: BuilderSampleFlowSeeder,
        private readonly dynamicExamplesSeeder: DynamicExamplesSeeder,
        private readonly tenantsSeeder: TenantsSeeder,
        private readonly subscriptionSeeder: SubscriptionSeeder,
        private readonly apiKeySeeder: ApiKeySeeder,
        private readonly providersCatalogBuilderSeeder: ProvidersCatalogBuilderSeeder,
    ) {}

    /**
     * Single public entry point for `npm run seed`. Idempotent — each step checks
     * for pre-existing data and either upserts or skips. Safe to re-run against a
     * partially-seeded database.
     */
    async runAll(): Promise<void> {
        this.logger.log('── Seed: catalog (providers, data sources, builder assets, analysis types, report types, plans)');
        await this.providerCatalogSeeder.seed();
        await this.providersCatalogBuilderSeeder.seed();
        await this.dataSourcesSeeder.seed();
        await this.builderAssetsSeeder.seed();
        await this.analysisCategoriesSeeder.seed();
        await this.builderCategoriesSeeder.seed();
        await this.nodeTypesSeeder.seed();
        await this.nodeDefinitionPatchSeeder.seed();
        // Note: AnalysisTypes seeder not yet created - would go here
        await this.reportTypesSeeder.seed();
        await this.plansSeeder.seed();

        this.logger.log('── Seed: DAG sample (brand-overview draft + analysis type link)');
        await this.builderSampleFlowSeeder.seed();
        await this.dynamicExamplesSeeder.seed();

        this.logger.log('── Seed: tenants (organization + users)');
        const org = await this.tenantsSeeder.seed();

        this.logger.log('── Seed: billing (subscription)');
        await this.subscriptionSeeder.seed(org._id);

        this.logger.log('── Seed: access (API key)');
        await this.apiKeySeeder.seed(org._id);

        this.logger.log('✓ Seed complete');
    }
}
