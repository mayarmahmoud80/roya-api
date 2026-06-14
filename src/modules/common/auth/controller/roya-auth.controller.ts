import {
    Body,
    Controller,
    Get,
    Patch,
    Post,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RoyaAuthService } from '../service/roya-auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';

@Controller('auth')
@ApiTags('auth')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class RoyaAuthController {
    constructor(private readonly authService: RoyaAuthService) {}

    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    getProfile(@CurrentUser('sub') userId: string) {
        return this.authService.getProfile(userId);
    }

    @Patch('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
        return this.authService.updateProfile(userId, dto);
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    changePassword(@CurrentUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
        return this.authService.changePassword(userId, dto);
    }
}
