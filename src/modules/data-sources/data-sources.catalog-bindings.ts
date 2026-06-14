import { Model } from 'mongoose';
import { DataSourceDocument } from './data-source.schema';
import { CatalogSource } from '../common/enums/catalog-source.enum';

/** Builds a Mongo filter for OAuth-style catalog rows (slug/connectorClass seeds, no providerKey). */
export function oauthStyleCatalogFilter(): Record<string, unknown> {
    return {
        $or: [
            { catalogSource: CatalogSource.OAUTH },
            {
                $and: [
                    {
                        $or: [
                            { providerKey: { $exists: false } },
                            { providerKey: '' },
                            { providerKey: null },
                        ],
                    },
                    {
                        connectorClass: { $exists: true, $type: 'string', $ne: '' },
                    },
                ],
            },
        ],
    };
}

export async function listEnabledCatalogBindings(
    model: Model<DataSourceDocument>,
): Promise<{ providerKey: string; implClass: string }[]> {
    const [builderRows, oauthRows] = await Promise.all([
        model
            .find({
                isActive: true,
                implClass: { $exists: true, $ne: '' },
                providerKey: { $exists: true, $type: 'string', $ne: '' },
            })
            .select('providerKey implClass')
            .lean()
            .exec(),
        model
            .find({
                isActive: { $ne: false },
                ...oauthStyleCatalogFilter(),
                connectorClass: { $exists: true, $type: 'string', $ne: '' },
            })
            .select('providerSlug slug connectorClass')
            .lean()
            .exec(),
    ]);

    const map = new Map<string, { providerKey: string; implClass: string }>();

    for (const r of oauthRows) {
        const slug = (r.providerSlug || r.slug) as string;
        const impl = r.connectorClass as string;
        if (slug && impl) map.set(slug, { providerKey: slug, implClass: impl });
    }
    for (const r of builderRows) {
        if (r.providerKey && r.implClass) {
            map.set(r.providerKey, { providerKey: r.providerKey, implClass: r.implClass });
        }
    }

    return Array.from(map.values());
}
