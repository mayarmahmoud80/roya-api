import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AssetScope } from '../../common/enums/asset-scope.enum';
import { BuilderAssetStatus } from '../../common/enums/builder-asset-status.enum';
import { BuilderAssetType } from '../../common/enums/builder-asset-type.enum';

export type BuilderAssetDocument = BuilderAsset & Document;

@Schema({ timestamps: true })
export class BuilderAsset {
    @Prop({ enum: Object.values(BuilderAssetType), required: true, index: true })
    public assetType: BuilderAssetType;

    @Prop({ type: Object, required: true })
    public name: Record<string, unknown>;

    @Prop({ required: true })
    public slug: string;

    @Prop({ type: Object })
    public description?: Record<string, unknown>;

    @Prop({ enum: Object.values(AssetScope), default: AssetScope.GLOBAL, index: true })
    public scope: AssetScope;

    @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
    public organizationId?: Types.ObjectId;

    @Prop({ enum: Object.values(BuilderAssetStatus), default: BuilderAssetStatus.ACTIVE, index: true })
    public status: BuilderAssetStatus;

    @Prop({ type: Object, default: {} })
    public metadata: Record<string, unknown>;

    /** Populated for `assetType: nodeDefinition` — flow connection points, roles, and config contract. */
    @Prop({ type: Object, required: false })
    public nodeDefinition?: Record<string, unknown>;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    public createdBy?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    public updatedBy?: Types.ObjectId;
}

export const BuilderAssetSchema = SchemaFactory.createForClass(BuilderAsset);
BuilderAssetSchema.index({ assetType: 1, scope: 1, organizationId: 1, slug: 1 }, { unique: true });
BuilderAssetSchema.index({ assetType: 1, status: 1 });
BuilderAssetSchema.index({ assetType: 1, 'nodeDefinition.nodeKind': 1, status: 1 });
BuilderAssetSchema.index({ assetType: 1, 'nodeDefinition.category': 1, status: 1 });
BuilderAssetSchema.index({ assetType: 1, 'nodeDefinition.builderCategoryKey': 1, status: 1 });
BuilderAssetSchema.index({ assetType: 1, 'nodeDefinition.nodeTypeKey': 1, status: 1 });
BuilderAssetSchema.index({ assetType: 1, 'nodeDefinition.providerKey': 1 });
