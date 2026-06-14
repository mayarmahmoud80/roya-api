import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    BuilderCategory,
    BuilderCategoryDocument,
} from '../../../modules/builder-categories/builder-category.schema';
import builderCategories from '../data/builder-categories.json';

@Injectable()
export class BuilderCategoriesSeeder {
    private readonly logger = new Logger(BuilderCategoriesSeeder.name);

    constructor(
        @InjectModel(BuilderCategory.name)
        private readonly builderCategoryModel: Model<BuilderCategoryDocument>,
    ) {}

    async seed(): Promise<void> {
        for (const seed of builderCategories) {
            await this.builderCategoryModel
                .updateOne(
                    { slug: seed.slug },
                    {
                        $set: {
                            key: seed.key,
                            slug: seed.slug,
                            localizedName: seed.localizedName,
                            localizedDescription: seed.localizedDescription,
                            icon: seed.icon,
                            color: seed.color,
                            sortOrder: seed.sortOrder,
                            allowedOutgoingCategoryKeys: seed.allowedOutgoingCategoryKeys,
                            allowedIncomingCategoryKeys: (seed as any).allowedIncomingCategoryKeys ?? [],
                            status: (seed as any).status ?? 'active',
                            isSystem: (seed as any).isSystem ?? true,
                        },
                    },
                    { upsert: true },
                )
                .exec();
        }
        this.logger.log(`Seeded ${builderCategories.length} builder categories`);
    }
}
