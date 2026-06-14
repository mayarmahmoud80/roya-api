import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common/interfaces';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { listEnabledCatalogBindings } from '../../data-sources/data-sources.catalog-bindings';
import { DataSource, DataSourceDocument } from '../../data-sources/data-source.schema';
import { DataSourceConnectionContract } from '../connection-contract.types';
import { BrowserlessProvider } from '../implementations/browserless/browserless.provider';
import { GoogleProvider } from '../implementations/google.provider';
import { InstagramProvider } from '../implementations/instagram.provider';
import { LogoPickerProvider } from '../implementations/logo-picker/logo-picker.provider';
import { OpenAIProvider } from '../implementations/openai.provider';
import { PravatarProvider } from '../implementations/pravatar/pravatar.provider';
import { SemrushProvider } from '../implementations/semrush.provider';
import { WebScraperProvider } from '../implementations/web-scraper/web-scraper.provider';
import { DataSourceProvider } from '../interfaces/data-source-provider.interface';
import { getDataSourceConnectionContract } from '../provider-connection-contracts.registry';

@Injectable()
export class DataSourceProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(DataSourceProviderRegistry.name);
  private readonly providers = new Map<string, DataSourceProvider>();
  private readonly codeMap: Record<string, DataSourceProvider>;

  public constructor(
    private readonly webScraper: WebScraperProvider,
    private readonly browserless: BrowserlessProvider,
    private readonly semrush: SemrushProvider,
    private readonly openAI: OpenAIProvider,
    private readonly google: GoogleProvider,
    private readonly instagram: InstagramProvider,
    private readonly logoPicker: LogoPickerProvider,
    private readonly pravatar: PravatarProvider,
    @InjectModel(DataSource.name)
    private readonly dataSourceModel: Model<DataSourceDocument>,
  ) {
    this.codeMap = {
      WebScraper: this.webScraper,
      Browserless: this.browserless,
      Semrush: this.semrush,
      OpenAI: this.openAI,
      Google: this.google,
      Instagram: this.instagram,
      LogoPicker: this.logoPicker,
      Pravatar: this.pravatar,
    };
  }

  public register(provider: DataSourceProvider): void {
    if (this.providers.has(provider.provider)) {
      throw new ConflictException(
        `Provider '${provider.provider}' is already registered in DataSourceProviderRegistry`,
      );
    }
    this.providers.set(provider.provider, provider);
    this.logger.log(`Registered provider: ${provider.provider}`);
  }

  public get(providerName: string): DataSourceProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new NotFoundException(
        `No DataSourceProvider registered for '${providerName}'`,
      );
    }
    return provider;
  }

  /** True when a handler is registered under this key (catalog + code binding applied). */
  public has(providerKey: string): boolean {
    return this.providers.has(providerKey);
  }

  public getConnectionContract(providerKey: string): DataSourceConnectionContract {
    const contract = getDataSourceConnectionContract(providerKey);
    if (!contract) {
      throw new NotFoundException(
        `No connection contract for data source provider '${providerKey}'`,
      );
    }
    return contract;
  }

  /**
   * Returns all code-registered provider names. Used by the admin UI to constrain
   * the provider select for `internal` DataSource rows so admins cannot create a
   * row that has no code handler behind it.
   */
  public getRegisteredProviderNames(): string[] {
    return Array.from(this.providers.keys()).sort();
  }

  /** `implClass` values that have a TypeScript provider binding (registry codeMap). */
  public getCodeBoundImplClassNames(): string[] {
    return Object.keys(this.codeMap).sort();
  }

  public async onModuleInit(): Promise<void> {
    const bindings = await listEnabledCatalogBindings(this.dataSourceModel);
    if (bindings.length === 0) {
      this.logger.warn(
        'Provider catalog has no enabled bindings; registering all code-bound data sources.',
      );
      for (const instance of Object.values(this.codeMap)) {
        this.register(instance);
      }
      return;
    }

    const registeredImpl = new Set<string>();
    for (const { providerKey, implClass } of bindings) {
      const instance = this.codeMap[implClass];
      if (!instance) {
        this.logger.warn(
          `Provider ${providerKey}: implClass "${implClass}" has no code binding, skipping registration`,
        );
        continue;
      }
      if (registeredImpl.has(implClass)) {
        this.logger.warn(
          `Skipping duplicate catalog binding: implClass "${implClass}" (providerKey ${providerKey})`,
        );
        continue;
      }
      registeredImpl.add(implClass);
      this.register(instance);
      this.logger.log(`Registered provider: ${providerKey} (${implClass})`);
    }
  }
}
