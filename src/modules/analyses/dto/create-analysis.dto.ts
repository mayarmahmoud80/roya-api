import { IsArray, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAnalysisDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsArray()
    @IsMongoId({ each: true })
    analysisTypeIds: string[];

    @IsArray()
    @IsMongoId({ each: true })
    reportTypeIds: string[];

    @IsOptional()
    parameters?: Record<string, any>;
}
