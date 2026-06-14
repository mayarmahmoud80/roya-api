import { IsString, IsOptional, IsObject, IsEnum, IsMongoId } from 'class-validator';
import { AuthScope } from '../../common/enums/auth-scope.enum';
import { Types } from 'mongoose';

export class CreateConnectionDto {
    /** Preferred: Mongo id of the unified {@link DataSource} catalog row. */
    @IsMongoId()
    @IsOptional()
    dataSourceId?: string;

    /**
     * @deprecated Resolve via {@link dataSourceId}. Kept for limited backward compatibility.
     */
    @IsString()
    @IsOptional()
    providerSlug?: string;

    @IsMongoId()
    @IsOptional()
    userId?: Types.ObjectId;

    @IsEnum(AuthScope)
    scope: AuthScope;

    @IsString()
    @IsOptional()
    apiKey?: string;

    @IsObject()
    @IsOptional()
    config?: Record<string, any>;
}
