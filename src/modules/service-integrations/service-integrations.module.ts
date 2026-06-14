import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServiceIntegration, ServiceIntegrationSchema } from './service-integration.schema';
import { ServiceIntegrationsService } from './service-integrations.service';
import { ServiceIntegrationsController } from './service-integrations.controller';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: ServiceIntegration.name, schema: ServiceIntegrationSchema }]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [ServiceIntegrationsService, EncryptionService],
    controllers: [ServiceIntegrationsController],
    exports: [ServiceIntegrationsService],
})
export class ServiceIntegrationsModule {}
