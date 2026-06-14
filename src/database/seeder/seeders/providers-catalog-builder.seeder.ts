import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import rows from '../data/providers-catalog-builder.json';

type CatalogSeedRow = {
    providerKey: string;
    displayName: string;
    description?: string;
    category?: string;
    implClass?: string;
    authType?: string;
    authScope?: string;
    icon?: string;
    imageUrl?: string;
    isEnabled?: boolean;
};

/**
 * Upserts flow-builder catalog rows into `datasources` (unified collection).
 */
@Injectable()
export class ProvidersCatalogBuilderSeeder {
    private readonly logger = new Logger(ProvidersCatalogBuilderSeeder.name);

    constructor(@InjectConnection() private readonly connection: Connection) {}

    async seed(): Promise<void> {
        const col = this.connection.collection('datasources');
        const list = rows as CatalogSeedRow[];
        for (const row of list) {
            const providerSlug = row.providerKey.toLowerCase().replace(/_/g, '-');
            const impl = row.implClass || row.providerKey;
            await col.updateOne(
                { providerKey: row.providerKey },
                {
                    $set: {
                        name: row.displayName,
                        providerKey: row.providerKey,
                        providerSlug,
                        provider: impl,
                        description: row.description,
                        category: row.category,
                        implClass: row.implClass,
                        connectorClass: row.implClass,
                        authType: row.authType ?? 'api_key',
                        authScope: row.authScope ?? 'organization',
                        icon: row.icon,
                        imageUrl: row.imageUrl,
                        isActive: row.isEnabled !== false,
                        catalogSource: 'builder',
                        kind: 'external',
                        requiredByDefault: false,
                    },
                    $setOnInsert: {
                        slug: `catalog-${row.providerKey}`,
                    },
                },
                { upsert: true },
            );
        }
        this.logger.log(`Seeded datasources builder catalog rows (${list.length} upserts)`);
    }
}
