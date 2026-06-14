import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Connection, ConnectionSchema } from './schemas/connection.schema';
import { DataSource, DataSourceSchema } from '../data-sources/data-source.schema';
import { ConnectionsService } from './connections.service';
import { ConnectionsController } from './connections.controller';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Connection.name, schema: ConnectionSchema },
            { name: DataSource.name, schema: DataSourceSchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [ConnectionsService, EncryptionService],
    controllers: [ConnectionsController],
    /** Re-export MongooseModule so importing modules can inject ConnectionModel. */
    exports: [ConnectionsService, MongooseModule],
})
export class ConnectionsModule {}
