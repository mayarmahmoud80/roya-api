import { IsString, IsOptional, MinLength } from 'class-validator';

export class RenameReportTypeDto {
    @IsString()
    @MinLength(1)
    name: string;

    @IsString()
    @IsOptional()
    description?: string;
}
