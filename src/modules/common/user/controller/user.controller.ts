import { Body, Controller, Get, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RestrictedGuard } from '../../security';
import { UserData, UserInput } from '../model';
import { UserService } from '../service';

@Controller('users')
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RestrictedGuard)
export class UserController {

    public constructor(
        private readonly userService: UserService
    ) { }

    @Get()
    @ApiOperation({ summary: 'Find users' })
    @ApiResponse({ status: HttpStatus.OK, isArray: true, type: UserData })
    public async find(): Promise<UserData[]> {
        return this.userService.find();
    }

    @Post()
    @ApiOperation({ summary: 'Create user' })
    @ApiResponse({ status: HttpStatus.CREATED, type: UserData })
    public async create(@Body() input: UserInput): Promise<UserData> {
        return this.userService.create(input);
    }

}
