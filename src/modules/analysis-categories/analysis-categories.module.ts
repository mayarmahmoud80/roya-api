import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AnalysisCategoryEntity, AnalysisCategorySchema } from './analysis-category.schema';
import { AnalysisCategoriesService } from './analysis-categories.service';
import { AnalysisCategoriesController } from './analysis-categories.controller';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: AnalysisCategoryEntity.name, schema: AnalysisCategorySchema }]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [AnalysisCategoriesService],
    controllers: [AnalysisCategoriesController],
    exports: [AnalysisCategoriesService, MongooseModule],
})
export class AnalysisCategoriesModule {}
