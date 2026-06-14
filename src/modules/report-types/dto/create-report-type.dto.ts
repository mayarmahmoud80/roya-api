import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LocalizedTextDto } from '../../common/dto/localized-text.dto';
import { AssetScope } from '../../common/enums/asset-scope.enum';

/**
 * Payload for creating or updating a {@link ReportType}. Only carries identity + publication
 * metadata; flow structure is authored through the builder endpoints on the report type's
 * version (`PUT /report-types/by-id/:id/flow`).
 */
export class CreateReportTypeDto {
    /** Optional; when omitted, derived from `localizedName` on create. */
    @IsString()
    @IsOptional()
    public name?: string;

    @IsString()
    @IsOptional()
    public description?: string;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    public localizedName: LocalizedTextDto;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    @IsOptional()
    public localizedDescription?: LocalizedTextDto;

    @IsString()
    @IsNotEmpty()
    public slug: string;

    @IsEnum(AssetScope)
    @IsOptional()
    public scope?: AssetScope;

    @IsMongoId()
    @IsOptional()
    public organizationId?: string;

    @IsBoolean()
    @IsOptional()
    public isStandalone?: boolean;

    @IsNumber()
    @IsOptional()
    public standalonePrice?: number;

    @IsNumber()
    @IsOptional()
    public estimatedDuration?: number;
}
