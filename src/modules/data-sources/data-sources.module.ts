import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource, DataSourceSchema } from './data-source.schema';
import { DataSourcesService } from './data-sources.service';
import { DataSourcesController } from './data-sources.controller';
import {
    ServiceIntegration,
    ServiceIntegrationSchema,
} from '../service-integrations/service-integration.schema';
import { Connection, ConnectionSchema } from '../connections/schemas/connection.schema';
import { ProvidersModule } from '../providers';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: DataSource.name, schema: DataSourceSchema },
            { name: ServiceIntegration.name, schema: ServiceIntegrationSchema },
            { name: Connection.name, schema: ConnectionSchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
        forwardRef(() => ProvidersModule),
    ],
    providers: [DataSourcesService],
    controllers: [DataSourcesController],
    exports: [DataSourcesService, MongooseModule],
})
export class DataSourcesModule {}
