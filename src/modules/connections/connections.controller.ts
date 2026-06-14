import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
    UsePipes,
    ValidationPipe,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConnectionsService } from './connections.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';

@Controller('connections')
@ApiTags('connections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ConnectionsController {
    constructor(private readonly service: ConnectionsService) {}

    @Get()
    findAll(
        @CurrentUser('organizationId') orgId: string,
        @CurrentUser('userId') userId: string,
        @Query('scope') scope?: 'user' | 'organization',
    ) {
        const filterUserId = scope === 'user' ? userId : undefined;
        return this.service.findAll(orgId, filterUserId);
    }

    @Get('data-source/:dataSourceId')
    findByDataSource(
        @CurrentUser('organizationId') orgId: string,
        @CurrentUser('userId') userId: string,
        @Param('dataSourceId') dataSourceId: string,
        @Query('scope') scope?: 'user' | 'organization',
    ) {
        const filterUserId = scope === 'user' ? userId : undefined;
        return this.service.findByDataSource(orgId, dataSourceId, filterUserId);
    }

    @Get('provider/:providerSlug')
    findByProvider(
        @CurrentUser('organizationId') orgId: string,
        @CurrentUser('userId') userId: string,
        @Param('providerSlug') providerSlug: string,
        @Query('scope') scope?: 'user' | 'organization',
    ) {
        const filterUserId = scope === 'user' ? userId : undefined;
        return this.service.findByProvider(orgId, providerSlug, filterUserId);
    }

    @Get(':id')
    findById(
        @CurrentUser('organizationId') orgId: string,
        @CurrentUser('userId') userId: string,
        @Param('id', ObjectIdPipe) id: string,
        @Query('scope') scope?: 'user' | 'organization',
    ) {
        const filterUserId = scope === 'user' ? userId : undefined;
        return this.service.findById(orgId, id, filterUserId);
    }

        @Post()
        create(
            @CurrentUser('organizationId') orgId: string,
            @Body() dto: CreateConnectionDto) { 
            return this.service.create(orgId, dto);
        }

    @Patch(':id')
    update(
        @CurrentUser('organizationId') orgId: string,
        @CurrentUser('userId') userId: string,
        @Param('id', ObjectIdPipe) id: string,
        @Body() dto: UpdateConnectionDto,
        @Query('scope') scope?: 'user' | 'organization',
    ) {
        const filterUserId = scope === 'user' ? userId : undefined;
        return this.service.update(orgId, id, dto, filterUserId);
    }

    @Delete(':id')
    remove(
        @CurrentUser('organizationId') orgId: string,
        @CurrentUser('userId') userId: string,
        @Param('id', ObjectIdPipe) id: string,
        @Query('scope') scope?: 'user' | 'organization',
    ) {
        const filterUserId = scope === 'user' ? userId : undefined;
        return this.service.remove(orgId, id, filterUserId);
    }
}
