import { ApiProperty } from '@nestjs/swagger';

export class AuthTokenInput {

    @ApiProperty({ example: 'user@roya.ai' })
    public email: string;

}
