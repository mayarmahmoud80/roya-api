import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';

export type BuilderCategoryDocument = BuilderCategory & Document;

@Schema({ collection: 'builder_categories', timestamps: true })
export class BuilderCategory {
    @Prop({ required: true, unique: true, index: true })
    public key: string;

    @Prop({ required: true, unique: true, index: true })
    public slug: string;

    @Prop({ type: Object, required: true })
    public localizedName: Record<string, unknown>;

    @Prop({ type: Object })
    public localizedDescription?: Record<string, unknown>;

    @Prop()
    public icon?: string;

    @Prop()
    public color?: string;

    @Prop({ default: 0, index: true })
    public sortOrder: number;

    @Prop({ enum: Object.values(BuilderAssetStatus), default: BuilderAssetStatus.ACTIVE, index: true })
    public status: BuilderAssetStatus;

    @Prop({ default: true })
    public isSystem: boolean;

    @Prop({ type: [String], default: [] })
    public allowedOutgoingCategoryKeys: string[];

    @Prop({ type: [String], default: [] })
    public allowedIncomingCategoryKeys: string[];

    @Prop({ type: [String], default: [] })
    public allowedSourceValueTypes?: string[];

    @Prop({ type: [String], default: [] })
    public allowedTargetValueTypes?: string[];

    @Prop({ type: [String], default: [] })
    public defaultNodeKinds?: string[];
}

export const BuilderCategorySchema = SchemaFactory.createForClass(BuilderCategory);
BuilderCategorySchema.index({ status: 1, sortOrder: 1, slug: 1 });
