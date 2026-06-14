import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Put,
    Query,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportTypesService } from './report-types.service';
import { CreateReportTypeDto } from './dto/create-report-type.dto';
import { RenameReportTypeDto } from './dto/rename-report-type.dto';
import { ReportFlowDraftInputDto } from './dto/dynamic-flow.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';

@Controller('report-types')
@ApiTags('report-types')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ReportTypesController {
    constructor(private readonly service: ReportTypesService) {}

    @Get()
    findAll(@Query() query: PaginationQueryDto) {
        return this.service.findAll(query);
    }

    /** Published report types as a minimal projection for dropdowns and attach UIs. */
    @Get('published/lite')
    findPublishedLite() {
        return this.service.findPublishedLiteList();
    }

    /** Lite list for builder UI with minimal fields (id, name, slug, status, timestamps). */
    @Get('builder/lite')
    findBuilderLite(@Query() query: PaginationQueryDto) {
        return this.service.findBuilderLiteList(query);
    }

    @Get('by-id/:id')
    findById(@Param('id', ObjectIdPipe) id: string) {
        return this.service.findById(id);
    }

    @Get('by-id/:id/flow')
    getReportFlow(@Param('id', ObjectIdPipe) id: string) {
        return this.service.getReportFlow(id);
    }

    @Put('by-id/:id/flow')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    saveReportFlow(@Param('id', ObjectIdPipe) id: string, @Body() dto: ReportFlowDraftInputDto) {
        return this.service.saveReportFlow(id, dto);
    }

    @Post('by-id/:id/flow/validate')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    validateReportFlow(@Param('id', ObjectIdPipe) id: string, @Body() dto?: ReportFlowDraftInputDto) {
        return this.service.validateReportFlow(id, dto);
    }

    @Get(':slug')
    findBySlug(@Param('slug') slug: string) {
        return this.service.findBySlug(slug);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    create(@Body() dto: CreateReportTypeDto) {
        return this.service.create(dto);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    update(@Param('id', ObjectIdPipe) id: string, @Body() dto: Partial<CreateReportTypeDto>) {
        return this.service.update(id, dto);
    }

    @Post(':id/publish')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    publish(@Param('id', ObjectIdPipe) id: string) {
        return this.service.publish(id);
    }

    @Post(':id/archive')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    archive(@Param('id', ObjectIdPipe) id: string) {
        return this.service.archive(id);
    }

    @Post(':id/rename')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    rename(@Param('id', ObjectIdPipe) id: string, @Body() dto: RenameReportTypeDto) {
        return this.service.rename(id, dto.name, dto.description);
    }

    @Post(':id/duplicate')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    duplicate(@Param('id', ObjectIdPipe) id: string) {
        return this.service.duplicate(id);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    remove(@Param('id', ObjectIdPipe) id: string) {
        return this.service.remove(id);
    }
}
