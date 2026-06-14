import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Header,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
    UsePipes,
    ValidationPipe,
    Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FastifyReply } from 'fastify';
import { AnalysesService } from './analyses.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { CreateEmbedTokenDto } from './dto/create-embed-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmbedOrJwtAuthGuard } from '../common/guards/embed-or-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';
import { Analysis, AnalysisDocument } from './analysis.schema';

@Controller('analyses')
@ApiTags('analyses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AnalysesController {
    constructor(
        private readonly service: AnalysesService,
        @InjectModel(Analysis.name) private readonly analysisModel: Model<AnalysisDocument>,
    ) {}

    @Get()
    findAll(
        @CurrentUser('organizationId') orgId: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.service.findAll(orgId, page, limit);
    }

    @Get('stats')
    getStats(@CurrentUser('organizationId') orgId: string) {
        return this.service.getDashboardStats(orgId);
    }

    @Post()
    create(
        @CurrentUser('organizationId') orgId: string,
        @CurrentUser('sub') userId: string,
        @Body() dto: CreateAnalysisDto,
    ) {
        return this.service.create(orgId, userId, dto);
    }

    @Get(':id')
    @UseGuards(EmbedOrJwtAuthGuard)
    findById(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
        @Req() req: { embed?: { analysisId: string } },
    ) {
        if (req.embed && req.embed.analysisId !== id) {
            throw new ForbiddenException('Embed token is scoped to a different analysis');
        }
        return this.service.findById(orgId, id);
    }

   

    /**
     * Mint a short-lived embed token scoped to this analysis. The returned
     * token grants read-only access to the analysis + its reports via the
     * `EmbedOrJwtAuthGuard`. Requires a normal authenticated user session.
     */
    @Post(':id/embed-token')
    mintEmbedToken(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
        @Body() dto: CreateEmbedTokenDto,
    ) {
        return this.service.mintEmbedToken(orgId, id, dto);
    }

    @Post(':id/regenerate')
    @ApiOperation({ summary: 'Re-run all reports for an analysis' })
    regenerate(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
    ) {
        return this.service.regenerate(orgId, id);
    }

    @Delete(':id')
    softDelete(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
    ) {
        return this.service.softDelete(orgId, id);
    }

    @Get(':id/stream')
    @Header('Content-Type', 'text/event-stream')
    @Header('Cache-Control', 'no-cache')
    @Header('Connection', 'keep-alive')
    async streamAnalysis(
        @Param('id', ObjectIdPipe) id: string,
        @CurrentUser('organizationId') orgId: string,
        @Res() reply: FastifyReply,
    ) {
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });

        const sendEvent = (data: any) => {
            reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const poll = async () => {
            try {
                const analysis = await this.analysisModel.findOne({
                    _id: new Types.ObjectId(id),
                    organizationId: new Types.ObjectId(orgId),
                }).exec();

                if (analysis) {
                    sendEvent({ status: analysis.status, completedAt: analysis.completedAt });

                    if (analysis.status === 'completed' || analysis.status === 'failed') {
                        reply.raw.end();
                        return;
                    }
                }

                setTimeout(poll, 2000);
            } catch {
                reply.raw.end();
            }
        };

        reply.raw.on('close', () => reply.raw.end());
        poll();
    }
}
