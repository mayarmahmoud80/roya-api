import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BuilderCategory, BuilderCategorySchema } from './builder-category.schema';
import { BuilderCategoriesService } from './builder-categories.service';
import { BuilderCategoriesController } from './builder-categories.controller';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: BuilderCategory.name, schema: BuilderCategorySchema }]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [BuilderCategoriesService],
    controllers: [BuilderCategoriesController],
    exports: [BuilderCategoriesService, MongooseModule],
})
export class BuilderCategoriesModule {}
