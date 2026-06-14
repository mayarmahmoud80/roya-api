import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AssetScope } from '../common/enums/asset-scope.enum';
import { PublicationStatus } from '../common/enums/publication-status.enum';

export type AnalysisTypeDocument = AnalysisType & Document;

@Schema({ timestamps: true })
export class AnalysisType {
    @Prop({ type: Object })
    public localizedName?: Record<string, unknown>;

    @Prop({ type: Object })
    public localizedDescription?: Record<string, unknown>;

    @Prop({ enum: Object.values(AssetScope), default: AssetScope.GLOBAL, index: true })
    public scope: AssetScope;

    @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
    public organizationId?: Types.ObjectId;

    @Prop({ enum: Object.values(PublicationStatus), default: PublicationStatus.DRAFT, index: true })
    public status: PublicationStatus;

    @Prop({ type: [{ reportTypeId: { type: Types.ObjectId, ref: 'ReportType' }, reportTypeVersionId: { type: Types.ObjectId, ref: 'ReportTypeVersion' }, order: Number }], default: [] })
    public reportTypes: Array<{ reportTypeId: Types.ObjectId; reportTypeVersionId: Types.ObjectId; order: number }>;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true, unique: true })
    slug: string;

    @Prop({ type: Types.ObjectId, ref: 'AnalysisCategoryEntity', index: true })
    analysisCategoryId?: Types.ObjectId;

    @Prop()
    legacyCategory?: string;

    @Prop()
    description: string;

    @Prop()
    icon: string;

    @Prop({ default: true })
    isActive: boolean;
}

export const AnalysisTypeSchema = SchemaFactory.createForClass(AnalysisType);
AnalysisTypeSchema.index({ scope: 1, organizationId: 1, slug: 1 }, { unique: true });
AnalysisTypeSchema.index({ status: 1, updatedAt: -1 });
