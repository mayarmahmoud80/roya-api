import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Organization, OrganizationSchema } from './organization.schema';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { User, userSchema } from '../common/user/model/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Organization.name, schema: OrganizationSchema },
            { name: User.name, schema: userSchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [OrganizationsService],
    controllers: [OrganizationsController],
    exports: [OrganizationsService, MongooseModule],
})
export class OrganizationsModule {}
