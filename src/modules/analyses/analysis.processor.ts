import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bull';
import { Model, Types } from 'mongoose';

import { Report, ReportDocument } from '../reports/report.schema';
import { Analysis, AnalysisDocument } from './analysis.schema';
import { ReportType, ReportTypeDocument } from '../report-types/report-type.schema';
import { ReportStatus } from '../common/enums/report-status.enum';
import { AnalysisStatus } from '../common/enums/analysis-status.enum';
import { DynamicFlowExecutionService } from './dynamic-flow-execution.service';
import { ReportsService } from '../reports/reports.service';

/** Pick the first direct failure; upstream messages are only cascades. */
function errorMessageFromRequiredFailures(
    failures: Array<{ code: string; message?: { values?: Record<string, string> } }>,
): string {
    const direct = failures.find(f => f.code !== 'upstream_required_failure') ?? failures[0];
    const en = direct?.message?.values?.en;
    return typeof en === 'string' && en.trim() ? en.trim() : 'Required flow step failed';
}

/**
 * Queue processor for analyses. All reports are executed through the dynamic flow pipeline
 * defined by the report type's published `publishedFlowSnapshot`. Legacy (fixed-order) execution
 * has been removed; report types without a dynamic snapshot must be republished before analyses
 * can run against them.
 */
@Processor('analysis-queue')
export class AnalysisProcessor {
    private readonly logger = new Logger(AnalysisProcessor.name);

    constructor(
        @InjectModel(Report.name) private readonly reportModel: Model<ReportDocument>,
        @InjectModel(Analysis.name) private readonly analysisModel: Model<AnalysisDocument>,
        @InjectModel(ReportType.name) private readonly reportTypeModel: Model<ReportTypeDocument>,
        private readonly dynamicFlowExecution: DynamicFlowExecutionService,
        private readonly reportsService: ReportsService,
    ) {}

    @Process('process-analysis')
    async processAnalysis(job: Job<{ analysisId: string; organizationId: string }>) {
        const { analysisId, organizationId } = job.data;
        this.logger.log(`Processing analysis ${analysisId}`);

        try {
            const analysis = await this.analysisModel
                .findOne({ _id: new Types.ObjectId(analysisId), organizationId: new Types.ObjectId(organizationId) })
                .lean()
                .exec();
            const inputs = (analysis?.parameters ?? {}) as Record<string, unknown>;

            const reports = await this.reportModel
                .find({
                    analysisId: new Types.ObjectId(analysisId),
                    status: ReportStatus.QUEUED,
                })
                .exec();

            for (const report of reports) {
                await this.processReport(report, organizationId, inputs);
            }

            const allReports = await this.reportModel
                .find({ analysisId: new Types.ObjectId(analysisId) })
                .exec();
            const allDone = allReports.every(
                r => r.status === ReportStatus.COMPLETED || r.status === ReportStatus.FAILED,
            );

            if (allDone) {
                await this.analysisModel.findByIdAndUpdate(analysisId, {
                    status: AnalysisStatus.COMPLETED,
                    completedAt: new Date(),
                });
            }
        } catch (err) {
            this.logger.error(`Analysis ${analysisId} failed: ${(err as Error).message}`);
            await this.analysisModel.findByIdAndUpdate(analysisId, {
                status: AnalysisStatus.FAILED,
            });
        }
    }

    private async processReport(
        report: ReportDocument,
        organizationId: string,
        inputs: Record<string, unknown>,
    ) {
        const reportId = String(report._id);
        // A report that is already FAILED before this run was triggered via regenerate; everything
        // else (first run, or a previously completed run being re-run) counts as 'initial'.
        const trigger: 'initial' | 'regenerate' =
            report.status === ReportStatus.FAILED ? 'regenerate' : 'initial';
        const runStartedAt = new Date();
        try {
            await this.reportModel.findByIdAndUpdate(report._id, { status: ReportStatus.GENERATING });

            const reportType = await this.reportTypeModel.findById(report.reportTypeId).exec();
            if (!reportType) throw new Error('Report type not found');

            const result = await this.dynamicFlowExecution.runPublishedFlow({
                reportType,
                organizationId,
                inputs,
            });

            if (result.requiredFailures.length > 0) {
                const errorMessage = errorMessageFromRequiredFailures(result.requiredFailures);
                const finishedAt = new Date();
                await this.reportsService.applyDynamicFlowExecutionUpdate(
                    organizationId,
                    reportId,
                    {
                        status: ReportStatus.FAILED,
                        errorMessage,
                        context: inputs,
                        requiredFailures: result.requiredFailures,
                        flowWarnings: result.flowWarnings,
                        branchResults: result.branchResults,
                        flowSnapshotVersion: result.flowSnapshotVersion,
                    },
                    {
                        executionTry: {
                            trigger,
                            status: 'failed',
                            flowSnapshotVersion: result.flowSnapshotVersion,
                            startedAt: runStartedAt,
                            finishedAt,
                            durationMs: finishedAt.getTime() - runStartedAt.getTime(),
                            errorMessage,
                            nodes: result.nodeTries,
                        },
                    },
                );
                this.logger.warn(
                    `Report ${reportId} failed (dynamic flow required failures=${result.requiredFailures.length})`,
                );
                return;
            }

            const finishedOk = new Date();
            await this.reportsService.applyDynamicFlowExecutionUpdate(
                organizationId,
                reportId,
                {
                    status: ReportStatus.COMPLETED,
                    context: inputs,
                    generatedAt: new Date(),
                    branchResults: result.branchResults,
                    flowWarnings: result.flowWarnings,
                    requiredFailures: result.requiredFailures,
                    flowSnapshotVersion: result.flowSnapshotVersion,
                },
                {
                    executionTry: {
                        trigger,
                        status: 'completed',
                        flowSnapshotVersion: result.flowSnapshotVersion,
                        startedAt: runStartedAt,
                        finishedAt: finishedOk,
                        durationMs: finishedOk.getTime() - runStartedAt.getTime(),
                        nodes: result.nodeTries,
                    },
                },
            );
            this.logger.log(
                `Report ${reportId} completed (terminals=${result.branchResults.length}, warnings=${result.flowWarnings.length})`,
            );
        } catch (err) {
            const message = (err as Error).message ?? 'Unknown error';
            this.logger.error(`Report ${reportId} failed: ${message}`);
            const finishedAt = new Date();
            // DAG did not complete (no partial node traces); still persist a failed try atomically with status.
            await this.reportsService.applyDynamicFlowExecutionUpdate(
                organizationId,
                reportId,
                {
                    status: ReportStatus.FAILED,
                    errorMessage: message,
                },
                {
                    executionTry: {
                        trigger,
                        status: 'failed',
                        startedAt: runStartedAt,
                        finishedAt,
                        durationMs: finishedAt.getTime() - runStartedAt.getTime(),
                        errorMessage: message,
                        nodes: [],
                    },
                    unsetLegacyStoredOutput: false,
                },
            );
        }
    }
}
