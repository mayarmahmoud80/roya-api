import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UserController } from './controller';
import { User, userSchema } from './model';
import { UserService } from './service';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: User.name, schema: userSchema }])
    ],
    providers: [
        UserService
    ],
    controllers: [
        UserController
    ],
    exports: [
        UserService
    ]
})
export class UserModule { }
