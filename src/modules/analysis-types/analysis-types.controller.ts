import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AnalysisTypesService } from './analysis-types.service';
import { CreateAnalysisTypeDto } from './dto/create-analysis-type.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Controller('analysis-types')
@ApiTags('analysis-types')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AnalysisTypesController {
    constructor(private readonly service: AnalysisTypesService) {}

    @Get()
    findAll(@Query() query: PaginationQueryDto) {
        return this.service.findAll(query);
    }

    @Get(':id')
    findById(@Param('id', ObjectIdPipe) id: string) {
        return this.service.findById(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    create(@Body() dto: CreateAnalysisTypeDto) {
        return this.service.create(dto);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    update(@Param('id', ObjectIdPipe) id: string, @Body() dto: Partial<CreateAnalysisTypeDto>) {
        return this.service.update(id, dto);
    }

    @Post(':id/publish')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    publish(@Param('id', ObjectIdPipe) id: string) {
        return this.service.publish(id);
    }

    @Post(':id/unpublish')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    unpublish(@Param('id', ObjectIdPipe) id: string) {
        return this.service.unpublish(id);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    remove(@Param('id', ObjectIdPipe) id: string) {
        return this.service.remove(id);
    }
}
