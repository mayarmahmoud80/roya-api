import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ReportStatus } from '../common/enums/report-status.enum';
import { ReportExecutionTry } from './types/execution-try.types';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
    @Prop({ type: Types.ObjectId, ref: 'Analysis', index: true })
    analysisId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ReportType', index: true })
    reportTypeId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
    organizationId: Types.ObjectId;

    @Prop({ enum: Object.values(ReportStatus), default: ReportStatus.QUEUED })
    status: ReportStatus;

    /** Aggregated context from data sources (e.g. WebScraper, Semrush), stored before AI generation. */
    @Prop({ type: Object })
    context: Record<string, unknown>;

    /**
     * Legacy persisted flat output only; new runs omit this and store payloads on
     * `branchResults[].data` instead (`GET /reports/:id` omits this key and exposes a synthetic
     * legacy branch when the document still has old `data` only).
     */
    @Prop({ type: Object })
    data: Record<string, any>;

    /**
     * Legacy type-tagged mirror of {@link data}; not written or returned by the API anymore.
     * The portal derives field types from `outputSchema` and flattened branch output.
     */
    @Prop({ type: Object, default: {} })
    dataWithTypes?: Record<string, { type: string; value: unknown }>;

    @Prop({ type: [Object], default: [] })
    failedParts: Array<{ key: string; provider?: string; message: string; retryable: boolean; failedAt: Date }>;

    @Prop({ type: Object, default: {} })
    retryMetadata: Record<string, unknown>;

    @Prop()
    errorMessage: string;

    @Prop()
    generatedAt: Date;

    @Prop()
    expiresAt: Date;

    @Prop()
    flowSnapshotVersion?: number;

    /**
     * Per-path terminal outcomes; `data` on completed rows is the canonical output: each top-level
     * key is `{ type: OutputFieldType, value: unknown }` (merged OUTPUT SCHEMA + executor), or legacy
     * raw values for older documents.
     */
    @Prop({ type: [Object], default: [] })
    branchResults?: Array<Record<string, unknown>>;

    @Prop({ type: [Object], default: [] })
    flowWarnings?: Array<Record<string, unknown>>;

    @Prop({ type: [Object], default: [] })
    requiredFailures?: Array<Record<string, unknown>>;

    /**
     * Per-run execution traces for debugging. Each entry captures one DAG run (initial or
     * regenerate) with every executed node's resolved inputs, outputs, timing, and error.
     * Hidden from all queries by default (`select: false`); retrieve explicitly via the
     * dedicated tries endpoint to keep list/detail projections light.
     */
    @Prop({ type: [Object], default: [], select: false })
    executionTries?: ReportExecutionTry[];
}

export const ReportSchema = SchemaFactory.createForClass(Report);
