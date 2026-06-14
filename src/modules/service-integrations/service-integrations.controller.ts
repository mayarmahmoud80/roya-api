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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ServiceIntegrationsService } from './service-integrations.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';

@Controller('integrations')
@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ServiceIntegrationsController {
    constructor(private readonly service: ServiceIntegrationsService) {}

    @Get()
    findAll(@CurrentUser('organizationId') orgId: string) {
        return this.service.findAll(orgId);
    }

    @Get(':id')
    findById(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
    ) {
        return this.service.findById(orgId, id);
    }

    @Post()
    create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateIntegrationDto) {
        return this.service.create(orgId, dto);
    }

    @Patch(':id')
    update(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
        @Body() dto: Partial<CreateIntegrationDto>,
    ) {
        return this.service.update(orgId, id, dto);
    }

    @Delete(':id')
    remove(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
    ) {
        return this.service.remove(orgId, id);
    }
}
