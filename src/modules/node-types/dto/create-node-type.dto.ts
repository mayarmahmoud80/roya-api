import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LocalizedTextDto } from '../../common/dto/localized-text.dto';
import { BuilderAssetStatus } from '../../common/enums/builder-asset-status.enum';

export class CreateNodeTypeDto {
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

    @IsEnum(BuilderAssetStatus)
    @IsOptional()
    public status?: BuilderAssetStatus;

    @IsString()
    public builderCategoryKey: string;

    @IsString()
    public executionFamily: string;

    @IsString()
    public executorKey: string;

    @IsString()
    public rendererKey: string;

    @IsObject()
    @IsOptional()
    public configSchema?: Record<string, unknown>;

    @IsArray()
    @IsOptional()
    public inputPortTemplate?: Record<string, unknown>[];

    @IsArray()
    @IsOptional()
    public outputPortTemplate?: Record<string, unknown>[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    public capabilities?: string[];

    @IsBoolean()
    @IsOptional()
    public supportsRetry?: boolean;

    @IsBoolean()
    @IsOptional()
    public supportsBranching?: boolean;

    @IsBoolean()
    @IsOptional()
    public supportsMultipleInbound?: boolean;

    @IsBoolean()
    @IsOptional()
    public supportsMultipleOutbound?: boolean;
}
