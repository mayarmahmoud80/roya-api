import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    organizationName: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    password: string;
}
