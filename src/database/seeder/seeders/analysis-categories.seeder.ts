import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    AnalysisCategoryEntity,
    AnalysisCategoryDocument,
} from '../../../modules/analysis-categories/analysis-category.schema';
import analysisCategories from '../data/analysis-categories.json';

@Injectable()
export class AnalysisCategoriesSeeder {
    private readonly logger = new Logger(AnalysisCategoriesSeeder.name);

    constructor(
        @InjectModel(AnalysisCategoryEntity.name)
        private readonly analysisCategoryModel: Model<AnalysisCategoryDocument>,
    ) {}

    async seed(): Promise<void> {
        for (const seed of analysisCategories) {
            await this.analysisCategoryModel
                .updateOne(
                    { slug: seed.slug },
                    {
                        $set: {
                            key: seed.key,
                            slug: seed.slug,
                            localizedName: seed.localizedName,
                            localizedDescription: seed.localizedDescription,
                            icon: seed.icon,
                            sortOrder: seed.sortOrder,
                            status: (seed as any).status ?? 'active',
                            isSystem: (seed as any).isSystem ?? true,
                        },
                    },
                    { upsert: true },
                )
                .exec();
        }
        this.logger.log(`Seeded ${analysisCategories.length} analysis categories`);
    }
}
