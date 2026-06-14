import { Type } from 'class-transformer';
import { IsEnum, IsMongoId, IsObject, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { LocalizedTextDto } from '../../common/dto/localized-text.dto';
import { AssetScope } from '../../common/enums/asset-scope.enum';
import { BuilderAssetStatus } from '../../common/enums/builder-asset-status.enum';
import { BuilderAssetType } from '../../common/enums/builder-asset-type.enum';
import { BuilderNodeDefinitionInputDto } from './node-definition.dto';

export class BuilderAssetDto {
    @IsEnum(BuilderAssetType)
    public assetType: BuilderAssetType;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    public name: LocalizedTextDto;

    @IsString()
    public slug: string;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    @IsOptional()
    public description?: LocalizedTextDto;

    @IsEnum(AssetScope)
    public scope: AssetScope;

    @IsMongoId()
    @IsOptional()
    public organizationId?: string;

    @IsEnum(BuilderAssetStatus)
    @IsOptional()
    public status?: BuilderAssetStatus;

    @IsObject()
    @IsOptional()
    public metadata?: Record<string, unknown>;

    /** When `assetType` is `nodeDefinition`, this holds the governed connection contract. */
    @ValidateIf(o => o.assetType === BuilderAssetType.NODE_DEFINITION)
    @ValidateNested()
    @Type(() => BuilderNodeDefinitionInputDto)
    @IsOptional()
    public nodeDefinition?: BuilderNodeDefinitionInputDto;
}

