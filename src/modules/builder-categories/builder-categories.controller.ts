import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { BuilderCategoriesService } from './builder-categories.service';
import { CreateBuilderCategoryDto } from './dto/create-builder-category.dto';

@Controller('builder-categories')
@ApiTags('builder-categories')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class BuilderCategoriesController {
    constructor(private readonly service: BuilderCategoriesService) {}

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
    create(@Body() dto: CreateBuilderCategoryDto) {
        return this.service.create(dto);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.OWNER)
    update(@Param('id', ObjectIdPipe) id: string, @Body() dto: Partial<CreateBuilderCategoryDto>) {
        return this.service.update(id, dto);
    }
}
