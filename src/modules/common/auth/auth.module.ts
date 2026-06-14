import { Module } from '@nestjs/common';

import { UserModule } from '../user';
import { AuthController } from './controller';
import { PublicApiKeyGuard } from './security';
import { AuthService } from './service';

@Module({
    imports: [
        UserModule
    ],
    providers: [
        AuthService,
        PublicApiKeyGuard
    ],
    controllers: [
        AuthController
    ],
    exports: [
        AuthService,
        PublicApiKeyGuard
    ]
})
export class AuthModule { }
