import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';

@Controller('organizations')
@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class OrganizationsController {
    constructor(private readonly service: OrganizationsService) {}

    @Get('me')
    getMyOrg(@CurrentUser('organizationId') orgId: string) {
        return this.service.findByUser(orgId);
    }

    @Patch('me')
    updateMyOrg(
        @CurrentUser('organizationId') orgId: string,
        @Body() dto: UpdateOrganizationDto,
    ) {
        return this.service.update(orgId, dto);
    }

    @Get('me/members')
    getMembers(@CurrentUser('organizationId') orgId: string) {
        return this.service.getMembers(orgId);
    }

    @Post('me/invite')
    @UseGuards(RolesGuard)
    @Roles(Role.OWNER, Role.ADMIN)
    inviteMember(
        @CurrentUser('organizationId') orgId: string,
        @Body() dto: InviteMemberDto,
    ) {
        return this.service.inviteMember(orgId, dto);
    }

    @Patch('me/members/:userId')
    @UseGuards(RolesGuard)
    @Roles(Role.OWNER, Role.ADMIN)
    updateMemberRole(
        @CurrentUser('organizationId') orgId: string,
        @Param('userId', ObjectIdPipe) userId: string,
        @Body() dto: UpdateMemberRoleDto,
    ) {
        return this.service.updateMemberRole(orgId, userId, dto);
    }
}
