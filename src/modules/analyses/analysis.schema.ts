import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AnalysisStatus } from '../common/enums/analysis-status.enum';

export type AnalysisDocument = Analysis & Document;

@Schema({ timestamps: true })
export class Analysis {
    @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
    organizationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    createdBy: Types.ObjectId;

    @Prop({ type: [Types.ObjectId], ref: 'AnalysisType' })
    analysisTypeIds: Types.ObjectId[];

    @Prop({ required: true })
    title: string;

    @Prop({ enum: Object.values(AnalysisStatus), default: AnalysisStatus.DRAFT })
    status: AnalysisStatus;

    @Prop({ type: Object, default: {} })
    parameters: Record<string, any>;

    @Prop()
    completedAt: Date;
}

export const AnalysisSchema = SchemaFactory.createForClass(Analysis);
