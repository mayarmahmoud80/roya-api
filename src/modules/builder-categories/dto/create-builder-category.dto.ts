import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { LocalizedTextDto } from '../../common/dto/localized-text.dto';
import { BuilderAssetStatus } from '../../common/enums/builder-asset-status.enum';

export class CreateBuilderCategoryDto {
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

    @IsString()
    @IsOptional()
    public color?: string;

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

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    public allowedOutgoingCategoryKeys?: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    public allowedIncomingCategoryKeys?: string[];
}
