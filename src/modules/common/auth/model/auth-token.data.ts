import { ApiProperty } from '@nestjs/swagger';

export class AuthTokenData {

    @ApiProperty()
    public token: string;

    @ApiProperty({ example: 'Bearer' })
    public tokenType: string;

    public constructor(token: string) {
        this.token = token;
        this.tokenType = 'Bearer';
    }

}
