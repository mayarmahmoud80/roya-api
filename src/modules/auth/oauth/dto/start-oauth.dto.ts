import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AuthScope } from '../../../common/enums/auth-scope.enum';

export class StartOAuthDto {
    @IsOptional()
    @IsEnum(AuthScope)
    scope?: AuthScope;

    /** Portal return URL after OAuth (e.g. https://host/app/connections). */
    @IsOptional()
    @IsString()
    redirectUrl?: string;
}
