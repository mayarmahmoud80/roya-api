import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PublicationStatus } from '../common/enums/publication-status.enum';

export type ReportTypeVersionDocument = ReportTypeVersion & Document;

/**
 * A versioned, immutable-once-published specification of a report's dynamic flow (DAG).
 *
 * Pre-DAG fields (`inputFields`, `dataSources`, `outputSections`, `aiMapping`,
 * `allowNoExternalData`, `flowLayout`, `validationSummary`) were removed after the DAG-only
 * refactor: every input, data source, transformation, schema and AI step is now a node in
 * `flowNodes` connected through `flowConnections`.
 */
@Schema({ timestamps: true })
export class ReportTypeVersion {
    @Prop({ type: Types.ObjectId, ref: 'ReportType', required: true, index: true })
    public reportTypeId: Types.ObjectId;

    @Prop({ required: true })
    public versionNumber: number;

    @Prop({ enum: Object.values(PublicationStatus), default: PublicationStatus.DRAFT, index: true })
    public status: PublicationStatus;

    @Prop({ required: true, default: 'en' })
    public defaultLanguage: string;

    /** Graph nodes authored in the builder. Each has `nodeId`, `definitionAssetId`, `config`, ports. */
    @Prop({ type: [Object], default: [] })
    public flowNodes: Record<string, unknown>[];

    /** Directed edges between node ports (source.portKey -> target.portKey). */
    @Prop({ type: [Object], default: [] })
    public flowConnections: Record<string, unknown>[];

    /** Immutable copy taken at publish time; the executor always reads from this. */
    @Prop({ type: Object, required: false })
    public publishedFlowSnapshot?: Record<string, unknown>;

    /** Result of the last `validate` / save for the dynamic flow draft (non-blocking metadata). */
    @Prop({ type: Object, required: false })
    public flowValidationSummary?: Record<string, unknown>;
}

export const ReportTypeVersionSchema = SchemaFactory.createForClass(ReportTypeVersion);
ReportTypeVersionSchema.index({ reportTypeId: 1, versionNumber: 1 }, { unique: true });
ReportTypeVersionSchema.index({ reportTypeId: 1, status: 1 });
