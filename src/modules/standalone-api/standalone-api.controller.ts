import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    Param,
    Post,
    Req,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';
import { Request } from 'express';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { Analysis, AnalysisDocument } from '../analyses/analysis.schema';
import { Report, ReportDocument } from '../reports/report.schema';
import { ReportType, ReportTypeDocument } from '../report-types/report-type.schema';
import { AnalysisStatus } from '../common/enums/analysis-status.enum';
import { ReportStatus } from '../common/enums/report-status.enum';
import { IsOptional, IsString } from 'class-validator';

class CreateStandaloneReportDto {
    /** Optional display title; default `API: {reportTypeSlug}`. */
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    parameters?: Record<string, any>;
}

@Controller('public/reports')
@ApiTags('standalone-api')
@UseGuards(ApiKeyGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class StandaloneApiController {
    constructor(
        @InjectModel(Analysis.name) private readonly analysisModel: Model<AnalysisDocument>,
        @InjectModel(Report.name) private readonly reportModel: Model<ReportDocument>,
        @InjectModel(ReportType.name) private readonly reportTypeModel: Model<ReportTypeDocument>,
        @InjectQueue('analysis-queue') private readonly queue: Queue,
    ) {}

    @Post(':reportTypeSlug')
    async createReport(
        @Param('reportTypeSlug') slug: string,
        @Body() dto: CreateStandaloneReportDto,
        @Req() req: Request & { user: any; apiKey: any },
    ) {
        const { organizationId, scopedReportTypeIds } = req.user;

        const reportType = await this.reportTypeModel.findOne({ slug, isActive: true, isStandalone: true }).exec();
        if (!reportType) {
            throw new ForbiddenException(`Report type '${slug}' not found or not available via API`);
        }

        if (!scopedReportTypeIds.includes(reportType._id.toString())) {
            throw new ForbiddenException(`Your API key does not have access to '${slug}'`);
        }

        const parameters = dto.parameters ?? {};
        const title = (dto.title && dto.title.trim()) || `API: ${slug}`;

        const analysis = await this.analysisModel.create({
            organizationId: new Types.ObjectId(organizationId),
            title,
            status: AnalysisStatus.RUNNING,
            parameters,
            analysisTypeIds: [],
        });

        const report = await this.reportModel.create({
            analysisId: analysis._id,
            reportTypeId: reportType._id,
            organizationId: new Types.ObjectId(organizationId),
            status: ReportStatus.QUEUED,
        });

        await this.queue.add('process-analysis', {
            analysisId: analysis._id.toString(),
            organizationId,
        });

        return {
            reportId: report._id,
            status: 'queued',
            pollUrl: `/api/v1/public/reports/${report._id}`,
        };
    }

    @Get(':id')
    async getReport(
        @Param('id') id: string,
        @Req() req: Request & { user: any },
    ) {
        const { organizationId } = req.user;
        const report = await this.reportModel.findOne({
            _id: new Types.ObjectId(id),
            organizationId: new Types.ObjectId(organizationId),
        }).populate('reportTypeId').exec();

        if (!report) throw new ForbiddenException('Report not found');
        return report;
    }
}
