import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APIKey, APIKeySchema } from './api-key.schema';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeyGuard } from './api-key.guard';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: APIKey.name, schema: APIKeySchema }]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [ApiKeysService, ApiKeyGuard],
    controllers: [ApiKeysController],
    exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}
