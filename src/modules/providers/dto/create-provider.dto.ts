import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthType } from '../../common/enums/auth-type.enum';
import { AuthScope } from '../../common/enums/auth-scope.enum';
import { ProviderCategory } from '../../common/enums/provider-category.enum';
import { OAuthConfig } from '../schemas/provider.schema';

export class CreateProviderDto {
    @IsString()
    @IsNotEmpty()
    slug: string;

    @IsString()
    @IsNotEmpty()
    displayName: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(ProviderCategory)
    @IsOptional()
    category?: ProviderCategory;

    @IsEnum(AuthType)
    @IsOptional()
    authType?: AuthType;

    @IsEnum(AuthScope)
    @IsOptional()
    authScope?: AuthScope;

    @IsObject()
    @IsOptional()
    oauthConfig?: OAuthConfig;

    @IsString()
    @IsOptional()
    connectorClass?: string;

    @IsString()
    @IsOptional()
    icon?: string;

    @IsString()
    @IsOptional()
    @MaxLength(2048)
    imageUrl?: string;

    @IsBoolean()
    @IsOptional()
    isEnabled?: boolean;
}
