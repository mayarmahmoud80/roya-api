import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AnalysisCategory } from '../../common/enums/analysis-category.enum';
import { LocalizedTextDto } from '../../common/dto/localized-text.dto';
import { AssetScope } from '../../common/enums/asset-scope.enum';
import { PublicationStatus } from '../../common/enums/publication-status.enum';

export class AnalysisReportTypeRefDto {
    @IsMongoId()
    public reportTypeId: string;

    @IsMongoId()
    @IsOptional()
    public reportTypeVersionId?: string;

    @IsNumber()
    public order: number;
}

export class CreateAnalysisTypeDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    @IsOptional()
    localizedName?: LocalizedTextDto;

    @IsString()
    @IsNotEmpty()
    slug: string;

    @IsMongoId()
    @IsOptional()
    analysisCategoryId?: string;

    @IsEnum(AnalysisCategory)
    @IsOptional()
    category?: AnalysisCategory;

    @IsString()
    @IsOptional()
    description?: string;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    @IsOptional()
    localizedDescription?: LocalizedTextDto;

    @IsEnum(AssetScope)
    @IsOptional()
    scope?: AssetScope;

    @IsMongoId()
    @IsOptional()
    organizationId?: string;

    @IsEnum(PublicationStatus)
    @IsOptional()
    status?: PublicationStatus;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AnalysisReportTypeRefDto)
    @IsOptional()
    reportTypes?: AnalysisReportTypeRefDto[];

    @IsString()
    @IsOptional()
    icon?: string;
}
