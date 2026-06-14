import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NodeType, NodeTypeSchema } from './node-type.schema';
import { NodeTypesService } from './node-types.service';
import { NodeTypesController } from './node-types.controller';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: NodeType.name, schema: NodeTypeSchema }]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [NodeTypesService],
    controllers: [NodeTypesController],
    exports: [NodeTypesService, MongooseModule],
})
export class NodeTypesModule {}
