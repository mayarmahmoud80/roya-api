import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';

export type NodeTypeDocument = NodeType & Document;

@Schema({ collection: 'node_types', timestamps: true })
export class NodeType {
    @Prop({ required: true, unique: true, index: true })
    public key: string;

    @Prop({ required: true, unique: true, index: true })
    public slug: string;

    @Prop({ type: Object, required: true })
    public localizedName: Record<string, unknown>;

    @Prop({ type: Object })
    public localizedDescription?: Record<string, unknown>;

    @Prop({ enum: Object.values(BuilderAssetStatus), default: BuilderAssetStatus.ACTIVE, index: true })
    public status: BuilderAssetStatus;

    @Prop({ required: true, index: true })
    public builderCategoryKey: string;

    @Prop({ required: true })
    public executionFamily: string;

    @Prop({ required: true })
    public executorKey: string;

    @Prop({ required: true })
    public rendererKey: string;

    @Prop({ type: Object, default: {} })
    public configSchema?: Record<string, unknown>;

    @Prop({ type: [Object], default: [] })
    public inputPortTemplate?: Record<string, unknown>[];

    @Prop({ type: [Object], default: [] })
    public outputPortTemplate?: Record<string, unknown>[];

    @Prop({ type: [String], default: [] })
    public capabilities?: string[];

    @Prop({ default: false })
    public supportsRetry?: boolean;

    @Prop({ default: false })
    public supportsBranching?: boolean;

    @Prop({ default: false })
    public supportsMultipleInbound?: boolean;

    @Prop({ default: false })
    public supportsMultipleOutbound?: boolean;
}

export const NodeTypeSchema = SchemaFactory.createForClass(NodeType);
NodeTypeSchema.index({ status: 1, builderCategoryKey: 1, slug: 1 });
