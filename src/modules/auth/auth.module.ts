import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { OAuthController } from './oauth/oauth.controller';
import { OAuthService } from './oauth/oauth.service';
import { OAuthConfigRegistry } from './oauth/oauth-config.registry';
import { ConnectionsModule } from '../connections/connections.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DataSource, DataSourceSchema } from '../data-sources/data-source.schema';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
    imports: [
        ConfigModule,
        ConnectionsModule,
        JwtModule.register({}),
        MongooseModule.forFeature([{ name: DataSource.name, schema: DataSourceSchema }]),
    ],
    controllers: [OAuthController],
    providers: [OAuthService, OAuthConfigRegistry, JwtAuthGuard, EncryptionService],
    exports: [OAuthService, OAuthConfigRegistry],
})
export class AuthModule {}
