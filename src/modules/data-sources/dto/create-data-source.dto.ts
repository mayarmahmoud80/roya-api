import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DataSourceType } from '../../common/enums/data-source-type.enum';
import { AuthType } from '../../common/enums/auth-type.enum';
import { DataSourceKind } from '../../common/enums/data-source-kind.enum';
import { CatalogSource } from '../../common/enums/catalog-source.enum';
import { ProviderCategory } from '../../common/enums/provider-category.enum';
import { AuthScope } from '../../common/enums/auth-scope.enum';

export class CreateDataSourceDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    slug?: string;

    @IsString()
    @IsOptional()
    providerSlug?: string;

    @IsString()
    @IsNotEmpty()
    provider: string;

    @IsEnum(DataSourceType)
    @IsOptional()
    type?: DataSourceType;

    @IsEnum(DataSourceKind)
    @IsOptional()
    kind?: DataSourceKind;

    @IsEnum(AuthType)
    @IsOptional()
    authType?: AuthType;

    @IsString()
    @IsOptional()
    baseEndpoint?: string;

    @IsBoolean()
    @IsOptional()
    requiredByDefault?: boolean;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    providerKey?: string;

    @IsString()
    @IsOptional()
    implClass?: string;

    @IsString()
    @IsOptional()
    connectorClass?: string;

    @IsEnum(ProviderCategory)
    @IsOptional()
    category?: ProviderCategory;

    @IsEnum(AuthScope)
    @IsOptional()
    authScope?: AuthScope;

    @IsString()
    @IsOptional()
    icon?: string;

    @IsString()
    @IsOptional()
    imageUrl?: string;

    @IsEnum(CatalogSource)
    @IsOptional()
    catalogSource?: CatalogSource;
}
