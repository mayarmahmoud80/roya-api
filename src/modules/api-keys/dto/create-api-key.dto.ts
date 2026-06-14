import { IsArray, IsDate, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateApiKeyDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsArray()
    @IsMongoId({ each: true })
    reportTypeIds: string[];

    @IsNumber()
    @IsOptional()
    rateLimit?: number;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    expiresAt?: Date;
}
