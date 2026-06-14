import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AssetScope } from '../../common/enums/asset-scope.enum';
import { BuilderAssetStatus } from '../../common/enums/builder-asset-status.enum';
import { NODE_KIND_VALUES, NodeCategory, NodeKind } from '../../common/enums/builder-node.enum';

/** List query for node definitions; uses builder asset `status` (not `PublicationStatus`). */
export class NodeDefinitionListQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    public page = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    public limit = 20;

    @IsOptional()
    @IsString()
    public search?: string;

    @IsOptional()
    @IsEnum(BuilderAssetStatus)
    public status?: BuilderAssetStatus;

    @IsOptional()
    @IsEnum(AssetScope)
    public scope?: AssetScope;

    @IsOptional()
    @IsIn(NODE_KIND_VALUES)
    public nodeKind?: NodeKind;

    /** Single palette category filter (`nodeDefinition.category`). */
    @IsOptional()
    @IsEnum(NodeCategory)
    public category?: NodeCategory;

    /** Comma-separated {@link NodeCategory} values (multi-tag filter). */
    @IsOptional()
    @IsString()
    public categories?: string;

    @IsOptional()
    @IsString()
    public builderCategoryKey?: string;

    @IsOptional()
    @IsString()
    public nodeTypeKey?: string;

    /** Default `updatedAt` preserves palette/registry callers; `category` uses palette sort order. */
    @IsOptional()
    @IsIn(['updatedAt', 'category', 'builderCategory'])
    public sortBy?: 'updatedAt' | 'category' | 'builderCategory';

    /**
     * When `true`, list includes inactive and archived definitions (admin / editor).
     * When omitted, only **active** definitions are returned (flow palette).
     */
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    public includeInactive?: boolean;
}
