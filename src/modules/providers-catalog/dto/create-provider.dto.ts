import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthType } from '../../common/enums/auth-type.enum';
import { AuthScope } from '../../common/enums/auth-scope.enum';

export class CreateProviderDto {
  @IsString()
  @IsNotEmpty()
  providerKey: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  implClass?: string;

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

  @IsEnum(AuthType)
  @IsOptional()
  authType?: AuthType;

  @IsEnum(AuthScope)
  @IsOptional()
  authScope?: AuthScope;
}
