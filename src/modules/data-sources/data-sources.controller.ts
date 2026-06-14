import {
    Body,
    Controller,
    Delete,
    Get,
    Inject,
    Param,
    Patch,
    Post,
    UseGuards,
    forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DataSourcesService } from './data-sources.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';
import { CreateProviderDto } from '../providers-catalog/dto/create-provider.dto';
import { UpdateProviderDto } from '../providers-catalog/dto/update-provider.dto';
import { DataSourceProviderRegistry } from '../providers/registry/data-source-provider.registry';

@Controller('data-sources')
@ApiTags('data-sources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class DataSourcesController {
    constructor(
        private readonly service: DataSourcesService,
        @Inject(forwardRef(() => DataSourceProviderRegistry))
        private readonly dataSourceProviderRegistry: DataSourceProviderRegistry,
    ) {}

    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Get('providers')
    listProviders() {
        return this.service.listProvidersForPicker();
    }

    @Get('picker-options')
    listPickerOptions() {
        return this.service.listPickerOptions();
    }

    @Get('catalog')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    catalogFindAll() {
        return this.service.findAllCatalog();
    }

    @Get('catalog/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    catalogFindOne(@Param('id') id: string) {
        return this.service.findOneCatalog(id);
    }

    @Get('impl-classes')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    listImplClasses() {
        return this.dataSourceProviderRegistry.getCodeBoundImplClassNames();
    }

    @Post('catalog')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    catalogCreate(@Body() dto: CreateProviderDto) {
        return this.service.createCatalogBuilder(dto);
    }

    @Patch('catalog/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    catalogUpdate(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
        return this.service.updateCatalogRow(id, dto);
    }

    @Delete('catalog/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    catalogRemove(@Param('id') id: string) {
        return this.service.removeCatalogRow(id);
    }

    @Post()
    create(@Body() dto: CreateDataSourceDto) {
        return this.service.create(dto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateDataSourceDto) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.service.remove(id);
    }
}
