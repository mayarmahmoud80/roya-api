import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { BuilderAssetsController } from './builder-assets.controller';
import { BuilderAssetsService } from './builder-assets.service';
import { BuilderAsset, BuilderAssetSchema } from './schemas/builder-asset.schema';
import { ReportTypesModule } from '../report-types/report-types.module';
import { S3Module } from '../clients/s3/s3.module';
import { BuilderCategory, BuilderCategorySchema } from '../builder-categories/builder-category.schema';
import { NodeType, NodeTypeSchema } from '../node-types/node-type.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: BuilderAsset.name, schema: BuilderAssetSchema },
            { name: BuilderCategory.name, schema: BuilderCategorySchema },
            { name: NodeType.name, schema: NodeTypeSchema },
        ]),
        ReportTypesModule,
        S3Module,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [BuilderAssetsService],
    controllers: [BuilderAssetsController],
    exports: [BuilderAssetsService, MongooseModule],
})
export class BuilderAssetsModule {}
