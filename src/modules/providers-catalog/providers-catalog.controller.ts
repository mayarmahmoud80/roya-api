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
import { DataSourcesService } from '../data-sources/data-sources.service';
import { DataSourceProviderRegistry } from '../providers/registry/data-source-provider.registry';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';

/**
 * @deprecated Prefer `/data-sources/catalog` equivalents. Kept for backward-compatible admin API paths.
 */
@Controller('providers-catalog')
@ApiTags('providers-catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ProvidersCatalogController {
  constructor(
    private readonly dataSources: DataSourcesService,
    @Inject(forwardRef(() => DataSourceProviderRegistry))
    private readonly dataSourceProviderRegistry: DataSourceProviderRegistry,
  ) {}

  @Get()
  findAll() {
    return this.dataSources.findAllCatalog();
  }

  @Get('impl-classes')
  listImplClasses() {
    return this.dataSourceProviderRegistry.getCodeBoundImplClassNames();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dataSources.findOneCatalog(id);
  }

  @Post()
  create(@Body() dto: CreateProviderDto) {
    return this.dataSources.createCatalogBuilder(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.dataSources.updateCatalogRow(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dataSources.removeCatalogRow(id);
  }
}
