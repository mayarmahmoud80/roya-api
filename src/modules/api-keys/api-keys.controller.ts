import { Body, Controller, Delete, Get, Param, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';

@Controller('api-keys')
@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ApiKeysController {
    constructor(private readonly service: ApiKeysService) {}

    @Get()
    findAll(@CurrentUser('organizationId') orgId: string) {
        return this.service.findAll(orgId);
    }

    @Post()
    create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateApiKeyDto) {
        return this.service.create(orgId, dto);
    }

    @Delete(':id')
    revoke(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
    ) {
        return this.service.revoke(orgId, id);
    }
}
