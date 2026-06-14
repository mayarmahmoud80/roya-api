import { Controller, Get, NotFoundException, Param, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { getDataSourceConnectionContract } from './provider-connection-contracts.registry';

@Controller('data-source-providers')
@ApiTags('data-source-providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class DataSourceProvidersController {
    @Get(':providerKey/connection-contract')
    public getConnectionContract(@Param('providerKey') providerKey: string) {
        const contract = getDataSourceConnectionContract(providerKey);
        if (!contract) {
            throw new NotFoundException(`No connection contract for data source provider '${providerKey}'`);
        }
        return contract;
    }
}
