import { Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmbedOrJwtAuthGuard } from '../common/guards/embed-or-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';

interface EmbedAwareRequest {
    embed?: { analysisId: string };
}

@Controller('reports')
@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ReportsController {
    constructor(private readonly service: ReportsService) {}

    /** Light analysis meta + report status rows for the embedded analysis shell. Must stay above `:id`. */
    @Get('analysis-overview/:analysisId')
    @UseGuards(EmbedOrJwtAuthGuard)
    async getAnalysisOverview(
        @CurrentUser('organizationId') orgId: string,
        @Param('analysisId', ObjectIdPipe) analysisId: string,
        @Req() req: EmbedAwareRequest,
    ) {
        if (req.embed && req.embed.analysisId !== analysisId) {
            throw new ForbiddenException('Embed token is scoped to a different analysis');
        }
        return this.service.findAnalysisOverview(orgId, analysisId);
    }

    @Get(':id/flow-results')
    @UseGuards(EmbedOrJwtAuthGuard)
    async getFlowResults(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
        @Req() req: EmbedAwareRequest,
    ) {
        if (req.embed) {
            const report = await this.service.findById(orgId, id);
            this.assertReportInEmbedScope(report, req.embed.analysisId);
        }
        return this.service.getFlowResults(orgId, id);
    }

    @Get(':id/tries')
    async getExecutionTries(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
    ) {
        return this.service.getExecutionTries(orgId, id);
    }

    /**
     * Full report document (populated `reportTypeId`). Response omits `data` / `dataWithTypes`;
     * use `branchResults[].data` (flatten completed branches on the client); legacy Mongo rows
     * with only `data` are adapted to a synthetic `branchResults` entry server-side.
     */
    @Get(':id')
    @UseGuards(EmbedOrJwtAuthGuard)
    async findById(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
        @Req() req: EmbedAwareRequest,
    ) {
        const report = await this.service.findById(orgId, id);
        if (req.embed) this.assertReportInEmbedScope(report, req.embed.analysisId);
        return report;
    }

    @Post(':id/regenerate')
    regenerate(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
    ) {
        return this.service.regenerate(orgId, id);
    }

    /** Pins embed-token access to reports that belong to the embedded analysis. */
    private assertReportInEmbedScope(
        report: unknown,
        embeddedAnalysisId: string,
    ): void {
        const rec = report as Record<string, unknown> | null | undefined;
        const raw = rec?.['analysisId'];
        const rAnalysisId = typeof raw === 'object' && raw !== null && 'toString' in (raw as object)
            ? String((raw as { toString(): string }).toString())
            : String(raw ?? '');
        if (rAnalysisId !== embeddedAnalysisId) {
            throw new ForbiddenException('Embed token is scoped to a different analysis');
        }
    }
}
