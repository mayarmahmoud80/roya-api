import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AssetScope } from '../common/enums/asset-scope.enum';
import { PublicationStatus } from '../common/enums/publication-status.enum';

export type ReportTypeDocument = ReportType & Document;

/**
 * Stable aggregate root for a "report template". Owns identity (slug), scope, publication
 * status, and version pointers. All structural fields (inputs, outputs, data sources, AI
 * mapping, flow graph) now live on {@link ReportTypeVersion} / its `publishedFlowSnapshot`.
 *
 * Legacy denormalized fields (`name`, `description` strings, `analysisTypeId`, `inputSchema`,
 * `outputSchema`, `dataSourceIds`, `isActive`) were removed with the DAG-only refactor; the
 * service derives an equivalent read-shape from the published flow snapshot when needed.
 */
@Schema({ timestamps: true })
export class ReportType {
    /**
     * Optional short display name for list / analysis UIs. When set, API responses and
     * populated joins prefer this over resolving {@link localizedName}.
     */
    @Prop()
    public name?: string;

    @Prop()
    public description?: string;

    @Prop({ type: Object, required: true })
    public localizedName: Record<string, unknown>;

    @Prop({ type: Object })
    public localizedDescription?: Record<string, unknown>;

    @Prop({ required: true, unique: true })
    public slug: string;

    @Prop({ enum: Object.values(AssetScope), default: AssetScope.GLOBAL, index: true })
    public scope: AssetScope;

    @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
    public organizationId?: Types.ObjectId;

    @Prop({ enum: Object.values(PublicationStatus), default: PublicationStatus.DRAFT, index: true })
    public status: PublicationStatus;

    @Prop({ type: Types.ObjectId, ref: 'ReportTypeVersion' })
    public currentPublishedVersionId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ReportTypeVersion' })
    public draftVersionId?: Types.ObjectId;

    @Prop({ default: false })
    public isStandalone: boolean;

    @Prop({ default: 0 })
    public standalonePrice: number;

    @Prop({ default: 30 })
    public estimatedDuration: number;
}

export const ReportTypeSchema = SchemaFactory.createForClass(ReportType);
ReportTypeSchema.index({ scope: 1, organizationId: 1, slug: 1 }, { unique: true });
ReportTypeSchema.index({ status: 1, updatedAt: -1 });
ReportTypeSchema.index({ currentPublishedVersionId: 1 });
