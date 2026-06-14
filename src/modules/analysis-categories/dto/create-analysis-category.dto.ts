import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { LocalizedTextDto } from '../../common/dto/localized-text.dto';
import { BuilderAssetStatus } from '../../common/enums/builder-asset-status.enum';

export class CreateAnalysisCategoryDto {
    @IsString()
    public key: string;

    @IsString()
    public slug: string;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    public localizedName: LocalizedTextDto;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    @IsOptional()
    public localizedDescription?: LocalizedTextDto;

    @IsString()
    @IsOptional()
    public icon?: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    public sortOrder?: number;

    @IsEnum(BuilderAssetStatus)
    @IsOptional()
    public status?: BuilderAssetStatus;

    @IsBoolean()
    @IsOptional()
    public isSystem?: boolean;
}
