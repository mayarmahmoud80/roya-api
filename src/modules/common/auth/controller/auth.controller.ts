import { Body, Controller, HttpStatus, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { UserService } from '../../user';
import { AuthTokenData, AuthTokenInput } from '../model';
import { PublicApiKeyGuard } from '../security';
import { AuthService } from '../service';

@Controller('auth')
@ApiTags('auth')
export class AuthController {

    public constructor(
        private readonly userService: UserService,
        private readonly authService: AuthService
    ) { }

    @Post('user-token')
    @UseGuards(PublicApiKeyGuard)
    @ApiHeader({
        name: 'x-api-key',
        required: true,
        description: 'Public frontend API key'
    })
    @ApiOperation({ summary: 'Create user JWT token' })
    @ApiResponse({ status: HttpStatus.CREATED, type: AuthTokenData })
    public async createUserToken(@Body() input: AuthTokenInput): Promise<AuthTokenData> {
        const user = await this.userService.findByEmail(input.email);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const token = this.authService.createUserToken(user.id, user.email, user.role as any);
        return new AuthTokenData(token);
    }

}
