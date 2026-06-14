import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BuilderAssetStatus } from '../common/enums/builder-asset-status.enum';

export type AnalysisCategoryDocument = AnalysisCategoryEntity & Document;

@Schema({ collection: 'analysis_categories', timestamps: true })
export class AnalysisCategoryEntity {
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

    @Prop({ default: 0, index: true })
    public sortOrder: number;

    @Prop({ enum: Object.values(BuilderAssetStatus), default: BuilderAssetStatus.ACTIVE, index: true })
    public status: BuilderAssetStatus;

    @Prop({ default: true })
    public isSystem: boolean;
}

export const AnalysisCategorySchema = SchemaFactory.createForClass(AnalysisCategoryEntity);
AnalysisCategorySchema.index({ status: 1, sortOrder: 1, slug: 1 });
