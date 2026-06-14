import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProvidersCatalogController } from './providers-catalog.controller';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [
    forwardRef(() => DataSourcesModule),
    forwardRef(() => ProvidersModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ProvidersCatalogController],
})
export class ProvidersCatalogModule {}
