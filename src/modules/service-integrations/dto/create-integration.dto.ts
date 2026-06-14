import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateIntegrationDto {
    @IsMongoId()
    @IsNotEmpty()
    dataSourceId: string;

    @IsString()
    @IsOptional()
    apiKey?: string;

    @IsOptional()
    config?: Record<string, any>;
}
