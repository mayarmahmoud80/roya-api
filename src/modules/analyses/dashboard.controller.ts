import { Controller, Get, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalysesService } from './analyses.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('dashboard')
@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class DashboardController {
    constructor(private readonly analysesService: AnalysesService) {}

    @Get('stats')
    getStats(@CurrentUser('organizationId') orgId: string) {
        return this.analysesService.getDashboardStats(orgId);
    }
}
