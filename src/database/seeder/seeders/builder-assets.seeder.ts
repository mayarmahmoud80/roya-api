import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BuilderAsset, BuilderAssetDocument } from '../../../modules/builder-assets/schemas/builder-asset.schema';
import { resolveProviderPorts } from '../helpers/provider-ports';
import schemaFieldTypes from '../data/schema-field-types.json';
import providerServices from '../data/provider-services.json';
import providers from '../data/providers.json';
import dataSourceAssets from '../data/data-source-assets.json';
import aiProviderAssets from '../data/ai-provider-assets.json';
import nodePaletteCategories from '../data/node-palette-categories.json';
import dictionaries from '../data/dictionaries.json';
import inputDefs from '../data/node-definitions/input.json';
import sourceDefs from '../data/node-definitions/source.json';
import aiDefs from '../data/node-definitions/ai.json';
import transformDefs from '../data/node-definitions/transform.json';
import schemaDefs from '../data/node-definitions/schema.json';
import terminalDefs from '../data/node-definitions/terminal.json';

@Injectable()
export class BuilderAssetsSeeder {
    private readonly logger = new Logger(BuilderAssetsSeeder.name);

    constructor(
        @InjectModel(BuilderAsset.name)
        private readonly builderAssetModel: Model<BuilderAssetDocument>,
    ) {}

    async seed(): Promise<void> {
        const allAssets = [
            ...schemaFieldTypes,
            ...providerServices,
            ...providers,
            ...dataSourceAssets,
            ...aiProviderAssets,
            ...nodePaletteCategories,
            ...dictionaries,
            ...inputDefs,
            ...sourceDefs,
            ...aiDefs,
            ...transformDefs,
            ...schemaDefs,
            ...terminalDefs,
        ];

        for (const asset of allAssets) {
            const doc: Record<string, unknown> = {  ...asset };
            const assetAny = asset as any;

            // For source node definitions with providerKey, resolve ports at runtime
            if (
                asset.assetType === 'nodeDefinition' &&
                assetAny.nodeDefinition &&
                'providerKey' in assetAny.nodeDefinition &&
                assetAny.nodeDefinition.providerKey
            ) {
                try {
                    const { inputs, outputs } = resolveProviderPorts(assetAny.nodeDefinition.providerKey as string);
                    doc.nodeDefinition = {
                        ...assetAny.nodeDefinition,
                        inputs,
                        outputs,
                    };
                } catch (error) {
                    this.logger.warn(`Failed to resolve ports for ${asset.slug}: ${(error as Error).message}`);
                }
            }

            await this.builderAssetModel.updateOne(
                {
                    assetType: asset.assetType,
                    scope: asset.scope,
                    slug: asset.slug,
                    organizationId: asset.scope === 'organization' && 'organizationId' in asset.metadata
                        ? asset.metadata.organizationId
                        : { $exists: false },
                },
                { $set: doc },
                { upsert: true },
            );
        }

        this.logger.log(`Seeded ${allAssets.length} builder assets`);
    }
}
