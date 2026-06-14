import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';
import { Analysis, AnalysisDocument } from '../analyses/analysis.schema';
import { mapRawReportsForAnalysisView } from '../common/utils/analysis-reports.mapper';
import { Report, ReportDocument } from './report.schema';
import { ReportStatus } from '../common/enums/report-status.enum';
import { ReportExecutionTry } from './types/execution-try.types';
import { truncateMongoFlowProbeUntilFits } from './utils/mongo-payload-bound.util';

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        @InjectModel(Report.name) private readonly reportModel: Model<ReportDocument>,
        @InjectModel(Analysis.name) private readonly analysisModel: Model<AnalysisDocument>,
        @InjectQueue('analysis-queue') private readonly analysisQueue: Queue,
    ) {}

    /**
     * Minimal projection for the portal analysis shell: meta + report rows without
     * `data`/context/full report-type snapshots (those come from flow-results per report).
     */
    async findAnalysisOverview(organizationId: string, analysisId: string) {
        const orgOid = new Types.ObjectId(organizationId);
        const analysisOid = new Types.ObjectId(analysisId);

        const analysis = await this.analysisModel
            .findOne({ _id: analysisOid, organizationId: orgOid })
            .select('_id title status parameters createdAt completedAt')
            .lean()
            .exec();

        if (!analysis) throw new NotFoundException('Analysis not found');

        const rawReports = await this.reportModel
            .find({ analysisId: analysisOid, organizationId: orgOid })
            .select('_id status errorMessage reportTypeId branchResults')
            .populate({
                path: 'reportTypeId',
                select: 'slug name localizedName localizedDescription description',
            })
            .lean()
            .exec();

        const reports = mapRawReportsForAnalysisView(rawReports as Array<Record<string, unknown>>);

        return { ...analysis, reports };
    }

    async findById(organizationId: string, id: string) {
        const report = await this.reportModel.findOne({
            _id: new Types.ObjectId(id),
            organizationId: new Types.ObjectId(organizationId),
        }).populate('reportTypeId').exec();

        if (!report) throw new NotFoundException('Report not found');

        const plainRaw = report.toObject ? report.toObject() : { ...report };
        const plain = plainRaw as Record<string, unknown>;

        this.hydrateLegacyBranchResults(plain);
        delete plain['data'];
        delete plain['dataWithTypes'];

        return plainRaw;
    }

    /**
     * Flow-result payload for the portal: branch output + warnings/failures only.
     * Omits parent analysis and full report (use GET /reports/:id and analysis-overview for that).
     */
    async getFlowResults(organizationId: string, id: string) {
        const report = await this.reportModel
            .findOne({
                _id: new Types.ObjectId(id),
                organizationId: new Types.ObjectId(organizationId),
            })
            .select('branchResults flowWarnings requiredFailures flowSnapshotVersion data generatedAt updatedAt')
            .lean()
            .exec();

        if (!report) throw new NotFoundException('Report not found');

        const plain = { ...report } as Record<string, unknown>;
        this.hydrateLegacyBranchResults(plain);

        return {
            reportId: id,
            flowSnapshotVersion: plain['flowSnapshotVersion'] as number | undefined,
            branchResults: (plain['branchResults'] as Array<Record<string, unknown>>) ?? [],
            flowWarnings: (plain['flowWarnings'] as Array<Record<string, unknown>>) ?? [],
            requiredFailures: (plain['requiredFailures'] as Array<Record<string, unknown>>) ?? [],
        };
    }

    /** Synthesizes `branchResults` from legacy top-level `data` when branches are empty. */
    private hydrateLegacyBranchResults(plain: Record<string, unknown>): void {
        const brExisting = plain['branchResults'] as unknown;
        const legacyData = plain['data'] as Record<string, unknown> | null | undefined;
        if (
            (!Array.isArray(brExisting) || brExisting.length === 0) &&
            legacyData &&
            typeof legacyData === 'object' &&
            !Array.isArray(legacyData) &&
            Object.keys(legacyData as object).length > 0
        ) {
            plain['branchResults'] = [
                {
                    pathId: 'legacy-stored-data',
                    terminalKey: '__legacy_data__',
                    status: 'completed',
                    required: false,
                    data: legacyData,
                    completedAt: plain['generatedAt'] ?? plain['updatedAt'] ?? new Date(),
                },
            ];
        }
    }

    /**
     * Single place to persist dynamic-flow execution fields on a report (branch results, warnings, snapshot version).
     * Keeps the shape consistent for {@link getFlowResults}.
     *
     * When `executionTry` is set, persists it in the **same atomic write** as the flow `$set`,
     * so crashes between “apply” and “append try” cannot leave a COMPLETED report without tries.
     */
    async applyDynamicFlowExecutionUpdate(
        organizationId: string,
        reportId: string,
        update: {
            flowSnapshotVersion?: number;
            branchResults?: Array<Record<string, unknown>>;
            flowWarnings?: Array<Record<string, unknown>>;
            requiredFailures?: Array<Record<string, unknown>>;
            context?: Record<string, unknown>;
            status: ReportStatus;
            errorMessage?: string | null;
            generatedAt?: Date;
        },
        options?: {
            executionTry?: Omit<ReportExecutionTry, 'tryNumber'>;
            /** Default true: clears legacy `data` / `dataWithTypes`. Set false for top-level-exception paths. */
            unsetLegacyStoredOutput?: boolean;
        },
    ) {
        const probe: Record<string, unknown> = {
            status: update.status,
        };
        if (update.context !== undefined) {
            probe['context'] = update.context;
        }
        if (update.errorMessage !== undefined) {
            probe['errorMessage'] = update.errorMessage;
        }
        if (update.generatedAt !== undefined) {
            probe['generatedAt'] = update.generatedAt;
        }
        if (update.flowSnapshotVersion !== undefined) {
            probe['flowSnapshotVersion'] = update.flowSnapshotVersion;
        }
        if (update.branchResults !== undefined) {
            probe['branchResults'] = update.branchResults;
        }
        if (update.flowWarnings !== undefined) {
            probe['flowWarnings'] = update.flowWarnings;
        }
        if (update.requiredFailures !== undefined) {
            probe['requiredFailures'] = update.requiredFailures;
        }
        if (options?.executionTry !== undefined) {
            probe['__executionTry'] = options.executionTry;
        }

        const fitted = truncateMongoFlowProbeUntilFits(probe) as Record<string, unknown>;
        const sanitizedTry = fitted['__executionTry'] as Omit<ReportExecutionTry, 'tryNumber'> | undefined;
        delete fitted['__executionTry'];

        const $set: Record<string, unknown> = fitted;

        const filter = { _id: new Types.ObjectId(reportId), organizationId: new Types.ObjectId(organizationId) };
        const unsetLegacy = options?.unsetLegacyStoredOutput !== false;

        if (options?.executionTry !== undefined) {
            const existing = await this.reportModel.findOne(filter).select('+executionTries').lean().exec();
            const tryNumber = (existing?.executionTries?.length ?? 0) + 1;
            const baseTry = sanitizedTry ?? options.executionTry;
            const fullTry: ReportExecutionTry = { ...baseTry, tryNumber };
            const mut: Record<string, unknown> = { $set, $push: { executionTries: fullTry } };
            if (unsetLegacy) {
                mut['$unset'] = { data: 1, dataWithTypes: 1 };
            }
            const res = await this.reportModel.updateOne(filter, mut).exec();
            if (res.matchedCount !== 1) {
                this.logger.warn(`applyDynamicFlowExecutionUpdate: no report matched ${reportId} (org)`);
            }
            return;
        }

        await this.reportModel
            .findOneAndUpdate(
                filter,
                unsetLegacy ? { $set, $unset: { data: 1, dataWithTypes: 1 } } : { $set },
                { new: true },
            )
            .exec();
    }

    /**
     * Append one execution try to a report (one per DAG run). `tryNumber` is derived from the
     * current array length so entries are monotonic and 1-based per report. Reports run in a
     * single worker at a time, so a plain read-then-push is safe here.
     */
    async appendExecutionTry(
        reportId: string,
        entry: Omit<ReportExecutionTry, 'tryNumber'>,
    ): Promise<void> {
        const existing = await this.reportModel
            .findById(new Types.ObjectId(reportId))
            .select('+executionTries')
            .lean()
            .exec();
        const tryNumber = (existing?.executionTries?.length ?? 0) + 1;
        const sanitized = truncateMongoFlowProbeUntilFits({
            __executionTry: { ...entry, tryNumber },
        }) as Record<string, unknown>;
        const full = sanitized['__executionTry'] as ReportExecutionTry;
        await this.reportModel
            .updateOne(
                { _id: new Types.ObjectId(reportId) },
                { $push: { executionTries: full } },
            )
            .exec();
    }

    /**
     * Return the full execution-tries payload for a report, org-scoped. Explicitly re-includes
     * the `executionTries` field (`select: false` at schema level) and trims the populated
     * reportType to the lightweight identification fields the tries UI needs.
     */
    async getExecutionTries(organizationId: string, reportId: string) {
        const report = await this.reportModel
            .findOne({
                _id: new Types.ObjectId(reportId),
                organizationId: new Types.ObjectId(organizationId),
            })
            .select('+executionTries analysisId reportTypeId status')
            .populate('reportTypeId', 'slug name localizedName')
            .lean()
            .exec();
        if (!report) {
            throw new NotFoundException('Report not found');
        }
        return {
            reportId,
            analysisId: report.analysisId,
            status: report.status,
            reportType: report.reportTypeId,
            tries: report.executionTries ?? [],
        };
    }

    async regenerate(organizationId: string, id: string) {
        const report = await this.reportModel.findOne({
            _id: new Types.ObjectId(id),
            organizationId: new Types.ObjectId(organizationId),
            status: ReportStatus.FAILED,
        }).exec();

        if (!report) throw new NotFoundException('Report not found or not in failed state');

        await this.reportModel.findByIdAndUpdate(id, {
            status: ReportStatus.QUEUED,
            errorMessage: null,
        });

        await this.analysisQueue.add('process-analysis', {
            analysisId: report.analysisId.toString(),
            organizationId,
        });

        return { message: 'Report regeneration queued' };
    }

    async preservePartialOutput(id: string, data: Record<string, unknown>, failedParts: Array<{ key: string; provider?: string; message: string; retryable: boolean }>) {
        const partsWithTimestamps = failedParts.map(part => ({ ...part, failedAt: new Date() }));
        const now = new Date();
        const report = await this.reportModel.findByIdAndUpdate(
            id,
            {
                $set: {
                    status: partsWithTimestamps.length > 0 ? ReportStatus.FAILED : ReportStatus.COMPLETED,
                    branchResults: [
                        {
                            pathId: 'path-partial-output',
                            terminalKey: '__partial_output__',
                            status: 'completed',
                            required: false,
                            data,
                            completedAt: now,
                        },
                    ],
                    failedParts: partsWithTimestamps,
                    retryMetadata: {
                        retryablePartCount: partsWithTimestamps.filter(part => part.retryable).length,
                        lastFailureAt: partsWithTimestamps[0]?.failedAt,
                    },
                    errorMessage: partsWithTimestamps[0]?.message,
                },
                $unset: { data: 1, dataWithTypes: 1 },
            },
            { new: true },
        ).exec();

        if (!report) throw new NotFoundException('Report not found');
        this.logger.warn({ event: 'report_partial_output_preserved', reportId: id, failedPartCount: partsWithTimestamps.length });
        return report;
    }
}
