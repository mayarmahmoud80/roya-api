import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DataSource, DataSourceDocument } from '../../../modules/data-sources/data-source.schema';
import { DataSourceKind } from '../../../modules/common/enums/data-source-kind.enum';
import dataSources from '../data/data-sources.json';

@Injectable()
export class DataSourcesSeeder {
    private readonly logger = new Logger(DataSourcesSeeder.name);

    constructor(
        @InjectModel(DataSource.name)
        private readonly dataSourceModel: Model<DataSourceDocument>,
    ) {}

    async seed(): Promise<void> {
        for (const src of dataSources) {
            await this.dataSourceModel
                .updateOne(
                    { slug: src.slug },
                    { $set: src, $setOnInsert: { requiredByDefault: false } },
                    { upsert: true },
                )
                .exec();
        }

        // Back-fill `kind` on any legacy rows that predate the field.
        await this.dataSourceModel
            .updateMany(
                { kind: { $exists: false } },
                { $set: { kind: DataSourceKind.EXTERNAL } },
            )
            .exec();

        // Back-fill `providerSlug` and `slug` on any legacy rows
        await this.dataSourceModel
            .updateMany(
                { providerSlug: { $exists: false } },
                [{ $set: { providerSlug: '$provider' } }],
            )
            .exec();

        this.logger.log('Seeded DataSources (upserted)');
    }
}
