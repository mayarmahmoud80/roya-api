import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AssetScope } from '../enums/asset-scope.enum';
import { PublicationStatus } from '../enums/publication-status.enum';

export class PaginationQueryDto {
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
    public limit = 25;

    @IsOptional()
    @IsString()
    public search?: string;

    @IsOptional()
    @IsEnum(PublicationStatus)
    public status?: PublicationStatus;
}

export class ScopedPaginationQueryDto extends PaginationQueryDto {
    @IsOptional()
    @IsEnum(AssetScope)
    public scope?: AssetScope;
}

