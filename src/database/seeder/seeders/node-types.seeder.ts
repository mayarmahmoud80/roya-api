import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NodeType, NodeTypeDocument } from '../../../modules/node-types/node-type.schema';
import nodeTypes from '../data/node-types.json';

@Injectable()
export class NodeTypesSeeder {
    private readonly logger = new Logger(NodeTypesSeeder.name);

    constructor(
        @InjectModel(NodeType.name)
        private readonly nodeTypeModel: Model<NodeTypeDocument>,
    ) {}

    async seed(): Promise<void> {
        for (const seed of nodeTypes) {
            const seedAny = seed as any;
            await this.nodeTypeModel
                .updateOne(
                    { slug: seed.slug },
                    {
                        $set: {
                            key: seed.key,
                            slug: seed.slug,
                            localizedName: seed.localizedName,
                            localizedDescription: seedAny.localizedDescription,
                            builderCategoryKey: seed.builderCategoryKey,
                            executionFamily: seed.executionFamily,
                            executorKey: seed.executorKey,
                            rendererKey: seed.rendererKey,
                            capabilities: seed.capabilities ?? [],
                            supportsRetry: seedAny.supportsRetry ?? false,
                            supportsBranching: seedAny.supportsBranching ?? false,
                            supportsMultipleInbound: seedAny.supportsMultipleInbound ?? false,
                            supportsMultipleOutbound: seedAny.supportsMultipleOutbound ?? false,
                            status: seed.status ?? 'active',
                        },
                    },
                    { upsert: true },
                )
                .exec();
        }
        this.logger.log(`Seeded ${nodeTypes.length} node types`);
    }
}
