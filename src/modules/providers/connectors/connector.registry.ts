import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common/interfaces';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ProviderConnector } from './connector.interface';
import { getDataSourceConnectionContract } from '../provider-connection-contracts.registry';
import { DataSourceConnectionContract } from '../connection-contract.types';
import { InstagramProvider } from '../implementations/instagram.provider';
import { BrowserlessProvider } from '../implementations/browserless/browserless.provider';
import { PravatarProvider } from '../implementations/pravatar/pravatar.provider';
import { WebScraperProvider } from '../implementations/web-scraper/web-scraper.provider';
import { SemrushProvider } from '../implementations/semrush.provider';
import { OpenAIProvider } from '../implementations/openai.provider';
import { GoogleProvider } from '../implementations/google.provider';
import { LogoPickerProvider } from '../implementations/logo-picker/logo-picker.provider';
import { DataSourceProvider } from '../interfaces/data-source-provider.interface';
import { ServiceIntegrationDocument } from '../../service-integrations/service-integration.schema';
import { DataSource, DataSourceDocument } from '../../data-sources/data-source.schema';

@Injectable()
export class ConnectorRegistry implements OnModuleInit {
    private readonly logger = new Logger(ConnectorRegistry.name);
    private readonly connectors = new Map<string, ProviderConnector>();
    private readonly codeMap: Record<string, ProviderConnector> = {};

    public constructor(
        @InjectModel(DataSource.name) private dataSourceModel: Model<DataSourceDocument>,
        private readonly instagramProvider: InstagramProvider,
        private readonly browserlessProvider: BrowserlessProvider,
        private readonly pravatarProvider: PravatarProvider,
        private readonly webScraperProvider: WebScraperProvider,
        private readonly semrushProvider: SemrushProvider,
        private readonly openAIProvider: OpenAIProvider,
        private readonly googleProvider: GoogleProvider,
        private readonly logoPickerProvider: LogoPickerProvider,
    ) {
        /** `connectorClass` from Provider catalog → runtime connector (slug-based `register` runs in onModuleInit). */
        this.registerConnector('Instagram', this.instagramProvider);
        this.registerConnector('Browserless', this.asConnector('browserless', this.browserlessProvider));
        this.registerConnector('Pravatar', this.asConnector('pravatar', this.pravatarProvider));
        this.registerConnector('WebScraper', this.asConnector('web-scraper', this.webScraperProvider));
        this.registerConnector('Semrush', this.asConnector('semrush', this.semrushProvider));
        this.registerConnector('OpenAI', this.asConnector('openai', this.openAIProvider));
        this.registerConnector('Google', this.asConnector('google', this.googleProvider));
        this.registerConnector('LogoPicker', this.asConnector('logo-picker', this.logoPickerProvider));
    }

    /** Bridges {@link DataSourceProvider} (integrations API) to {@link ProviderConnector} (connections + analysis). */
    private asConnector(providerSlug: string, inner: DataSourceProvider): ProviderConnector {
        return {
            providerSlug,
            getConnectionContract: () => inner.getConnectionContract(),
            execute: async (params) => {
                await inner.execute({
                    inputs: params.inputs ?? {},
                    config: params.config,
                    definitionAsset: params.definitionAsset,
                    integration: params.connection as unknown as ServiceIntegrationDocument,
                    context: params.context,
                    requiredByDefault: params.requiredByDefault,
                });
            },
        };
    }

    public registerConnector(connectorClass: string, connector: ProviderConnector): void {
        this.codeMap[connectorClass] = connector;
    }

    public register(connector: ProviderConnector): void {
        if (this.connectors.has(connector.providerSlug)) {
            throw new ConflictException(
                `Connector '${connector.providerSlug}' is already registered in ConnectorRegistry`,
            );
        }
        this.connectors.set(connector.providerSlug, connector);
        this.logger.log(`Registered connector: ${connector.providerSlug}`);
    }

    public get(providerSlug: string): ProviderConnector {
        const connector = this.connectors.get(providerSlug);
        if (!connector) {
            throw new NotFoundException(
                `No ProviderConnector registered for '${providerSlug}'`,
            );
        }
        return connector;
    }

    public has(providerSlug: string): boolean {
        return this.connectors.has(providerSlug);
    }

    public getConnectionContract(providerSlug: string): DataSourceConnectionContract {
        const contract = getDataSourceConnectionContract(providerSlug);
        if (!contract) {
            throw new NotFoundException(
                `No connection contract for provider '${providerSlug}'`,
            );
        }
        return contract;
    }

    public getRegisteredProviderSlugs(): string[] {
        return Array.from(this.connectors.keys()).sort();
    }

    public getCodeBoundConnectorClasses(): string[] {
        return Object.keys(this.codeMap).sort();
    }

    public async onModuleInit(): Promise<void> {
        const enabledRows = await this.dataSourceModel
            .find({
                isActive: { $ne: false },
                connectorClass: { $exists: true, $type: 'string', $ne: '' },
            })
            .exec();

        if (enabledRows.length === 0) {
            this.logger.warn(
                'No enabled data sources with connectorClass in database; registering all code-bound connectors.',
            );
            for (const instance of Object.values(this.codeMap)) {
                this.register(instance);
            }
            return;
        }

        const registeredClasses = new Set<string>();
        for (const row of enabledRows) {
            const connectorClass = row.connectorClass;
            if (!connectorClass) {
                this.logger.debug(
                    `DataSource ${row.slug}: no connectorClass specified, skipping`,
                );
                continue;
            }

            const instance = this.codeMap[connectorClass];
            if (!instance) {
                this.logger.warn(
                    `DataSource ${row.slug}: connectorClass "${connectorClass}" has no code binding, skipping registration`,
                );
                continue;
            }

            if (registeredClasses.has(connectorClass)) {
                this.logger.warn(
                    `Skipping duplicate binding: connectorClass "${connectorClass}" (data source ${row.slug})`,
                );
                continue;
            }

            registeredClasses.add(connectorClass);
            this.register(instance);
            this.logger.log(`Registered connector: ${row.providerSlug || row.slug} (${connectorClass})`);
        }
    }
}
