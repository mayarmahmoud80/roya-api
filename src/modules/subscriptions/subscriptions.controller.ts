import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { UpgradeSubscriptionDto } from './dto/upgrade.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';

@Controller()
@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class SubscriptionsController {
    constructor(private readonly service: SubscriptionsService) {}

    @Get('subscriptions/me')
    getMySubscription(@CurrentUser('organizationId') orgId: string) {
        return this.service.getMySubscription(orgId);
    }

    @Post('subscriptions/upgrade')
    upgrade(@CurrentUser('organizationId') orgId: string, @Body() dto: UpgradeSubscriptionDto) {
        return this.service.upgrade(orgId, dto);
    }

    @Post('subscriptions/cancel')
    cancel(@CurrentUser('organizationId') orgId: string) {
        return this.service.cancel(orgId);
    }

    @Get('invoices')
    getInvoices(
        @CurrentUser('organizationId') orgId: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.service.getInvoices(orgId, page, limit);
    }

    @Get('invoices/:id')
    getInvoice(
        @CurrentUser('organizationId') orgId: string,
        @Param('id', ObjectIdPipe) id: string,
    ) {
        return this.service.getInvoiceById(orgId, id);
    }

    @Get('usage/me')
    getCurrentUsage(@CurrentUser('organizationId') orgId: string) {
        return this.service.getCurrentUsage(orgId);
    }

    @Get('usage/me/history')
    getUsageHistory(
        @CurrentUser('organizationId') orgId: string,
        @Query('months') months?: number,
    ) {
        return this.service.getUsageHistory(orgId, months);
    }
}
