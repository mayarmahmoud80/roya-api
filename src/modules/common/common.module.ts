import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TerminusModule } from '@nestjs/terminus';

import { AuthModule } from './auth';
import { config } from './configs/environtment';
import { HealthController } from './controller';
import { LogInterceptor } from './flow';
import { configProvider, LoggerService } from './provider';
import { UserModule } from './user';

@Module({
    imports: [
        TerminusModule,
        MongooseModule.forRoot(config.DATABASE_URL),
        UserModule,
        AuthModule
    ],
    providers: [
        configProvider,
        LoggerService,
        LogInterceptor,
    ],
    exports: [
        configProvider,
        LoggerService,
        LogInterceptor,
    ],
    controllers: [
        HealthController
    ],
})
export class CommonModule {}
