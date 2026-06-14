import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BuilderAsset, BuilderAssetDocument } from '../../../modules/builder-assets/schemas/builder-asset.schema';
import { ReportTypeVersion, ReportTypeVersionDocument } from '../../../modules/report-types/report-type-version.schema';
import { BuilderValueType, NodeKind, ND_MERGER_DEFINITION_SLUG, ND_MAPPER_DEFINITION_SLUG } from '../../../modules/common/enums/builder-node.enum';
import { PublicationStatus } from '../../../modules/common/enums/publication-status.enum';
import { resolveCategory } from '../../../modules/common/node-category-rules';
import nodeDefinitionMetaBackfill from '../data/node-definition-meta-backfill.json';

@Injectable()
export class NodeDefinitionPatchSeeder {
    private readonly logger = new Logger(NodeDefinitionPatchSeeder.name);

    constructor(
        @InjectModel(BuilderAsset.name)
        private readonly builderAssetModel: Model<BuilderAssetDocument>,
        @InjectModel(ReportTypeVersion.name)
        private readonly reportTypeVersionModel: Model<ReportTypeVersionDocument>,
    ) {}

    async seed(): Promise<void> {
        await this.backfillNodeDefinitionCategories();
        await this.backfillNodeDefinitionMeta();
        await this.patchNdOutputSchemaInputCompatibleTypes();
        await this.patchNdTransformNodeKinds();
        await this.patchNdMergerInputUnlimited();
        await this.migrateGenericDraftNodeDefinitions();
    }

    private async backfillNodeDefinitionCategories(): Promise<void> {
        const missing = await this.builderAssetModel
            .find({
                assetType: 'nodeDefinition',
                'nodeDefinition.category': { $exists: false },
            })
            .lean()
            .exec();
        if (missing.length === 0) return;
        for (const doc of missing) {
            const nd = (doc.nodeDefinition ?? {}) as Record<string, unknown>;
            const kind = nd['nodeKind'] as NodeKind | undefined;
            if (!kind) continue;
            const category = resolveCategory(undefined, kind);
            if (!category) continue;
            await this.builderAssetModel
                .updateOne({ _id: doc._id }, { $set: { 'nodeDefinition.category': category } })
                .exec();
        }
        this.logger.log(`Back-filled category on ${missing.length} node-definition asset(s)`);
    }

    private async backfillNodeDefinitionMeta(): Promise<void> {
        for (const seed of nodeDefinitionMetaBackfill) {
            await this.builderAssetModel
                .updateOne(
                    { assetType: 'nodeDefinition', slug: seed.slug },
                    {
                        $set: {
                            'nodeDefinition.builderCategoryKey': seed.builderCategoryKey,
                            'nodeDefinition.nodeTypeKey': seed.nodeTypeKey,
                        },
                    },
                )
                .exec();
        }
        this.logger.log(`Back-filled builderCategoryKey/nodeTypeKey on ${nodeDefinitionMetaBackfill.length} node definitions`);
    }

    private async patchNdOutputSchemaInputCompatibleTypes(): Promise<void> {
        const doc = await this.builderAssetModel
            .findOne({ assetType: 'nodeDefinition', slug: 'nd-output-schema' })
            .lean()
            .exec();
        if (!doc?.nodeDefinition) return;

        const nd = doc.nodeDefinition as {
            inputs?: Array<{ key: string; compatibleValueTypes?: string[]; [k: string]: unknown }>;
        };
        const inputs = nd.inputs ?? [];
        const idx = inputs.findIndex(p => p.key === 'in');
        if (idx < 0) return;

        const expected = [BuilderValueType.OBJECT, BuilderValueType.ARRAY, BuilderValueType.ANY];
        const cur = inputs[idx].compatibleValueTypes ?? [];
        const aligned = expected.length === cur.length && expected.every(t => cur.includes(t));
        if (aligned) return;

        const nextInputs = [...inputs];
        nextInputs[idx] = { ...inputs[idx], compatibleValueTypes: expected };

        await this.builderAssetModel
            .updateOne({ _id: doc._id }, { $set: { 'nodeDefinition.inputs': nextInputs } })
            .exec();
        this.logger.log('Patched nd-output-schema `in` compatibleValueTypes (object, array, any)');
    }

    private async patchNdTransformNodeKinds(): Promise<void> {
        const legacyKinds = ['mapper', 'merger'] as const;
        const assetRes = await this.builderAssetModel
            .updateMany(
                {
                    assetType: 'nodeDefinition',
                    $or: [
                        { slug: { $in: [ND_MAPPER_DEFINITION_SLUG, ND_MERGER_DEFINITION_SLUG] } },
                        { 'nodeDefinition.nodeKind': { $in: [...legacyKinds] } },
                    ],
                },
                { $set: { 'nodeDefinition.nodeKind': NodeKind.TRANSFORM } },
            )
            .exec();
        if (assetRes.modifiedCount > 0) {
            this.logger.log(
                `Patched nodeDefinition.nodeKind → transform on ${assetRes.modifiedCount} builder asset(s)`,
            );
        }

        const flowRes = await this.reportTypeVersionModel
            .updateMany(
                { status: PublicationStatus.DRAFT },
                { $set: { 'flowNodes.$[n].nodeKind': NodeKind.TRANSFORM } },
                { arrayFilters: [{ 'n.nodeKind': { $in: [...legacyKinds] } }] },
            )
            .exec();
        if (flowRes.modifiedCount > 0) {
            this.logger.log(`Patched flowNodes.nodeKind → transform on ${flowRes.modifiedCount} draft report version(s)`);
        }
    }

    private async patchNdMergerInputUnlimited(): Promise<void> {
        const doc = await this.builderAssetModel
            .findOne({ assetType: 'nodeDefinition', slug: ND_MERGER_DEFINITION_SLUG })
            .lean()
            .exec();
        if (!doc?.nodeDefinition) return;
        const nd = doc.nodeDefinition as { inputs?: Array<{ key: string; maxConnections?: number }> };
        const inputs = nd.inputs ?? [];
        const idx = inputs.findIndex(p => p.key === 'in');
        if (idx < 0) return;
        if (inputs[idx].maxConnections == null) return;
        const nextInputs = [...inputs];
        const { maxConnections: _drop, ...rest } = nextInputs[idx];
        nextInputs[idx] = rest;
        await this.builderAssetModel
            .updateOne({ _id: doc._id }, { $set: { 'nodeDefinition.inputs': nextInputs } })
            .exec();
        this.logger.log('Patched nd-merger: removed maxConnections cap on input `in` (multi-wire merger)');
    }

    private async migrateGenericDraftNodeDefinitions(): Promise<void> {
        const genericSlugs = ['nd-data-source', 'nd-ai-provider'];
        const genericAssets = await this.builderAssetModel
            .find({ assetType: 'nodeDefinition', slug: { $in: genericSlugs } })
            .lean()
            .exec();
        if (genericAssets.length === 0) return;
        const genericIds = new Set(genericAssets.map(a => String(a._id)));

        const drafts = await this.reportTypeVersionModel
            .find({ status: PublicationStatus.DRAFT, 'flowNodes.0': { $exists: true } })
            .exec();
        if (drafts.length === 0) return;

        const allNodeDefs = await this.builderAssetModel
            .find({ assetType: 'nodeDefinition' })
            .lean()
            .exec();
        const bySlug = new Map(allNodeDefs.map(d => [d.slug, d]));
        const legacyMap: Record<string, string> = {
            WebScraper: 'nd-source-web-scraper',
            LogoPicker: 'nd-source-logo-picker',
            Semrush: 'nd-source-semrush',
            OpenAI: 'nd-ai-openai-gpt54-mini',
        };

        let rewritten = 0;
        for (const version of drafts) {
            let dirty = false;
            const nodes = (version.flowNodes ?? []) as unknown as Array<Record<string, unknown>>;
            for (const n of nodes) {
                const defId = String(n['definitionAssetId'] ?? '');
                if (!genericIds.has(defId)) continue;
                const cfg = (n['config'] ?? {}) as Record<string, unknown>;
                const provider = (cfg['provider'] ?? cfg['providerKey']) as string | undefined;
                const targetSlug = provider && legacyMap[provider] ? legacyMap[provider] : null;
                if (!targetSlug) continue;
                const target = bySlug.get(targetSlug);
                if (!target) continue;
                n['definitionAssetId'] = target._id;
                dirty = true;
                rewritten += 1;
            }
            if (dirty) {
                version.markModified('flowNodes');
                await version.save();
            }
        }
        if (rewritten > 0) {
            this.logger.log(`Migrated ${rewritten} generic nodeDefinition reference(s) in draft flows`);
        }
    }
}
