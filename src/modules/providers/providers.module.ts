import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { EncryptionService } from '../common/services/encryption.service';
import { DataSource, DataSourceSchema } from '../data-sources/data-source.schema';
import { ConnectorRegistry } from './connectors/connector.registry';
import { LogoPickerService } from '../clients/logo-picker/logo-picker.service';
import { OpenAIModule } from '../clients/openai/openai.module';
import { PravatarModule } from '../clients/pravatar/pravatar.module';
import { S3Module } from '../clients/s3/s3.module';
import { ScraperModule } from '../clients/scraper/scraper.module';
import { SemrushModule } from '../clients/semrush/semrush.module';
import { InstagramModule } from '../clients/instagram/instagram.module';

import { DataSourceProvidersController } from './data-source-providers.controller';
import { BrowserlessProvider } from './implementations/browserless/browserless.provider';
import { GoogleProvider } from './implementations/google.provider';
import { LogoPickerProvider } from './implementations/logo-picker/logo-picker.provider';
import { OpenAIProvider } from './implementations/openai.provider';
import { PravatarProvider } from './implementations/pravatar/pravatar.provider';
import { SemrushProvider } from './implementations/semrush.provider';
import { WebScraperProvider } from './implementations/web-scraper/web-scraper.provider';
import { InstagramProvider } from './implementations/instagram.provider';
import { DataSourceProviderRegistry } from './registry/data-source-provider.registry';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DataSource.name, schema: DataSourceSchema }]),
    SemrushModule,
    ScraperModule,
    OpenAIModule,
    InstagramModule,
    S3Module,
    PravatarModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [DataSourceProvidersController],
  providers: [
    EncryptionService,
    ConnectorRegistry,
    DataSourceProviderRegistry,
    WebScraperProvider,
    BrowserlessProvider,
    SemrushProvider,
    OpenAIProvider,
    GoogleProvider,
    InstagramProvider,
    LogoPickerProvider,
    LogoPickerService,
    PravatarProvider,
  ],
  exports: [DataSourceProviderRegistry, ConnectorRegistry],
})
export class ProvidersModule {}
