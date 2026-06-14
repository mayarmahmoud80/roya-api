import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
    @IsString() @IsOptional() name?: string;
    @IsEmail() @IsOptional() email?: string;
    @IsString() @IsOptional() avatarUrl?: string;
}
