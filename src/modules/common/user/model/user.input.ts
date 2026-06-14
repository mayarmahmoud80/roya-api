import { ApiProperty } from '@nestjs/swagger';

import { Role } from '../../../tokens';

export class UserInput {

    @ApiProperty({ example: 'user@roya.ai' })
    public email: string;

    @ApiProperty({ enum: Role, example: Role.USER })
    public role: Role;

}
