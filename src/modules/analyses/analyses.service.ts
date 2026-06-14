import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';
import { Analysis, AnalysisDocument } from './analysis.schema';
import { Report, ReportDocument } from '../reports/report.schema';
import { ReportType, ReportTypeDocument } from '../report-types/report-type.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { CreateEmbedTokenDto } from './dto/create-embed-token.dto';
import { AnalysisStatus } from '../common/enums/analysis-status.enum';
import { PublicationStatus } from '../common/enums/publication-status.enum';
import { ReportStatus } from '../common/enums/report-status.enum';
import { mapRawReportsForAnalysisView } from '../common/utils/analysis-reports.mapper';

export interface EmbedTokenPayload {
    typ: 'embed';
    scope: 'analysis';
    analysisId: string;
    organizationId: string;
    allowedOrigin?: string;
    iat?: number;
    exp?: number;
}

@Injectable()
export class AnalysesService {
    constructor(
        @InjectModel(Analysis.name) private readonly analysisModel: Model<AnalysisDocument>,
        @InjectModel(Report.name) private readonly reportModel: Model<ReportDocument>,
        @InjectModel(ReportType.name) private readonly reportTypeModel: Model<ReportTypeDocument>,
        @InjectQueue('analysis-queue') private readonly analysisQueue: Queue,
        private readonly subscriptionsService: SubscriptionsService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    /**
     * Mint a short-lived, read-only JWT scoped to a single analysis so other
     * apps can embed the hosted analysis view via `<iframe>` without the user
     * JWT leaving a trusted environment.
     *
     * The returned token is valid for `ttlSeconds` (clamped to [60, 86400],
     * default 900). It carries `typ: 'embed'` and is verified by
     * {@link EmbedOrJwtAuthGuard} on the read-only endpoints consumed by the
     * portal's `/embed/analyses/:id` page.
     */
    async mintEmbedToken(
        organizationId: string,
        analysisId: string,
        dto: CreateEmbedTokenDto,
    ): Promise<{ token: string; url: string; expiresAt: string; analysisId: string }> {
        const analysis = await this.analysisModel.findOne({
            _id: new Types.ObjectId(analysisId),
            organizationId: new Types.ObjectId(organizationId),
        }).select('_id').lean().exec();
        if (!analysis) throw new NotFoundException('Analysis not found');

        const ttlSeconds = Math.min(Math.max(dto.ttlSeconds ?? 900, 60), 24 * 60 * 60);
        const payload: EmbedTokenPayload = {
            typ: 'embed',
            scope: 'analysis',
            analysisId,
            organizationId,
            allowedOrigin: dto.allowedOrigin,
        };

        const secret = this.configService.get<string>('JWT_SECRET');
        const token = await this.jwtService.signAsync(payload, {
            secret,
            expiresIn: ttlSeconds,
        });

        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
        const portalUrl = (this.configService.get<string>('PORTAL_URL') || '').replace(/\/+$/, '');
        const url = portalUrl ? `${portalUrl}/embed/analyses/${analysisId}?token=${token}` : '';

        return { token, url, expiresAt, analysisId };
    }

    async findAll(organizationId: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const filter = { organizationId: new Types.ObjectId(organizationId) };

        const [analyses, total] = await Promise.all([
            this.analysisModel
                .find(filter)
                .select('_id title status createdAt parameters')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            this.analysisModel.countDocuments(filter),
        ]);

        const analysisIds = (analyses as any[]).map(a => a._id);
        const reportCounts = await this.reportModel.aggregate([
            { $match: { analysisId: { $in: analysisIds } } },
            { $group: { _id: '$analysisId', count: { $sum: 1 } } },
        ]);

        const countMap = new Map((reportCounts as { _id: Types.ObjectId; count: number }[]).map(r => [r._id.toString(), r.count]));
        const analysesWithCount = (analyses as any[]).map(a => ({
            ...a,
            reportsCount: countMap.get(a._id.toString()) ?? 0,
        }));

        return { items: analysesWithCount, total, page, limit };
    }

    async findById(organizationId: string, id: string) {
        const analysis = await this.analysisModel.findOne({
            _id: new Types.ObjectId(id),
            organizationId: new Types.ObjectId(organizationId),
        }).exec();

        if (!analysis) throw new NotFoundException('Analysis not found');

        const rawReports = await this.reportModel
            .find({ analysisId: analysis._id })
            .populate('reportTypeId')
            .lean()
            .exec();

        const reports = mapRawReportsForAnalysisView(rawReports as Array<Record<string, unknown>>);

        return { ...analysis.toObject(), reports };
    }

    async create(organizationId: string, userId: string, dto: CreateAnalysisDto) {
        // Validate report types exist and are published (ReportType no longer has isActive; see publication status)
        const objectIds = dto.reportTypeIds.map(id => new Types.ObjectId(id));
        const reportTypes = await this.reportTypeModel
            .find({
                _id: { $in: objectIds },
                status: PublicationStatus.PUBLISHED,
            })
            .exec();

        if (reportTypes.length !== dto.reportTypeIds.length) {
            throw new ForbiddenException('One or more report types are invalid or not published');
        }

        // Check usage limits for each report type
        for (const rt of reportTypes) {
            await this.subscriptionsService.checkAndIncrement(
                organizationId,
                rt._id.toString(),
                rt.slug,
            );
        }

        // Create analysis
        const analysis = await this.analysisModel.create({
            organizationId: new Types.ObjectId(organizationId),
            createdBy: new Types.ObjectId(userId),
            analysisTypeIds: dto.analysisTypeIds.map(id => new Types.ObjectId(id)),
            title: dto.title,
            status: AnalysisStatus.DRAFT,
            parameters: dto.parameters || {},
        });

        // Create report docs
        const reportDocs = await Promise.all(
            reportTypes.map(rt =>
                this.reportModel.create({
                    analysisId: analysis._id,
                    reportTypeId: rt._id,
                    organizationId: new Types.ObjectId(organizationId),
                    status: ReportStatus.QUEUED,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                }),
            ),
        );

        // Add to queue
        await this.analysisQueue.add('process-analysis', {
            analysisId: analysis._id.toString(),
            organizationId,
        });

        // Update analysis status to running
        await this.analysisModel.findByIdAndUpdate(analysis._id, { status: AnalysisStatus.RUNNING });

        return { ...analysis.toObject(), reports: reportDocs };
    }

    /**
     * Re-queue all reports for an analysis and enqueue background processing.
     * Does not charge subscription usage again (unlike {@link create}).
     */
    async regenerate(organizationId: string, id: string) {
        const analysis = await this.analysisModel
            .findOne({
                _id: new Types.ObjectId(id),
                organizationId: new Types.ObjectId(organizationId),
            })
            .exec();

        if (!analysis) throw new NotFoundException('Analysis not found');
        if (analysis.status === AnalysisStatus.RUNNING) {
            throw new ConflictException('Analysis is already running');
        }

        const orgOid = new Types.ObjectId(organizationId);
        const analysisOid = analysis._id;

        await this.reportModel.updateMany(
            { analysisId: analysisOid, organizationId: orgOid },
            {
                $set: {
                    status: ReportStatus.QUEUED,
                    failedParts: [],
                    branchResults: [],
                    flowWarnings: [],
                    requiredFailures: [],
                    retryMetadata: {},
                },
                $unset: {
                    context: 1,
                    data: 1,
                    dataWithTypes: 1,
                    errorMessage: 1,
                    generatedAt: 1,
                    flowSnapshotVersion: 1,
                    executionTries: 1,
                },
            },
        ).exec();

        await this.analysisQueue.add('process-analysis', {
            analysisId: analysisOid.toString(),
            organizationId,
        });

        const updated = await this.analysisModel
            .findByIdAndUpdate(
                analysisOid,
                { $set: { status: AnalysisStatus.RUNNING }, $unset: { completedAt: 1 } },
                { new: true },
            )
            .exec();

        if (!updated) throw new NotFoundException('Analysis not found');
        return updated;
    }

    async getDashboardStats(organizationId: string) {
        const orgId = new Types.ObjectId(organizationId);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [totalAnalyses, thisMonthAnalyses, statusGroups, monthlyTrend] = await Promise.all([
            this.analysisModel.countDocuments({ organizationId: orgId }),
            this.analysisModel.countDocuments({ organizationId: orgId, createdAt: { $gte: startOfMonth } }),
            this.analysisModel.aggregate([
                { $match: { organizationId: orgId } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            this.analysisModel.aggregate([
                {
                    $match: {
                        organizationId: orgId,
                        createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
                    },
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
            ]),
        ]);

        const statusBreakdown: Record<string, number> = { draft: 0, running: 0, completed: 0, failed: 0 };
        for (const g of statusGroups) {
            statusBreakdown[g._id as string] = g.count;
        }

        return {
            totalAnalyses,
            thisMonthAnalyses,
            completedAnalyses: statusBreakdown['completed'],
            runningAnalyses: statusBreakdown['running'],
            statusBreakdown,
            monthlyTrend,
        };
    }

    async softDelete(organizationId: string, id: string) {
        const analysis = await this.analysisModel.findOneAndUpdate(
            { _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) },
            { status: AnalysisStatus.FAILED },
            { new: true },
        ).exec();

        if (!analysis) throw new NotFoundException('Analysis not found');
        return analysis;
    }
}
