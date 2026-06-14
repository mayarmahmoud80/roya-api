import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsEnum,
    IsIn,
    IsInt,
    IsMongoId,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { LocalizedTextDto } from '../../common/dto/localized-text.dto';
import {
    BuilderNodeExecutionRole,
    BuilderValueType,
    NODE_KIND_VALUES,
    NodeCategory,
    NodeConnectionDirection,
    NodeKind,
} from '../../common/enums/builder-node.enum';
import { AssetScope } from '../../common/enums/asset-scope.enum';
import { BuilderAssetStatus } from '../../common/enums/builder-asset-status.enum';

export class RetryPolicyDto {
    @IsInt()
    @Min(1)
    public maxAttempts: number;

    @IsInt()
    @Min(0)
    public backoffMs: number;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    public retryableErrorCodes?: string[];
}

export class NodeConnectionPointDto {
    @IsString()
    public key: string;

    @IsEnum(NodeConnectionDirection)
    public direction: NodeConnectionDirection;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    public label: LocalizedTextDto;

    @IsEnum(BuilderValueType)
    public valueType: BuilderValueType;

    @IsBoolean()
    public required: boolean;

    @IsInt()
    @Min(0)
    public minConnections: number;

    @IsInt()
    @Min(1)
    @IsOptional()
    public maxConnections?: number;

    @IsArray()
    @IsIn(NODE_KIND_VALUES, { each: true })
    @IsOptional()
    public compatibleNodeKinds?: NodeKind[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    public compatibleNodeTypeKeys?: string[];

    @IsArray()
    @ArrayMinSize(1)
    @IsEnum(BuilderValueType, { each: true })
    public compatibleValueTypes: BuilderValueType[];

    @IsObject()
    @IsOptional()
    public validationRules?: Record<string, unknown>;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    @IsOptional()
    public errorMessage?: LocalizedTextDto;
}

/** Input for create/update of a `BuilderAsset` with `assetType: nodeDefinition`. */
export class BuilderNodeDefinitionInputDto {
    @IsIn(NODE_KIND_VALUES)
    public nodeKind: NodeKind;

    /**
     * Stable category used for palette grouping and the default connection-rule matrix.
     * When omitted, the category is derived from `nodeKind` for back-compat.
     */
    @IsEnum(NodeCategory)
    @IsOptional()
    public category?: NodeCategory;

    @IsString()
    @IsOptional()
    public builderCategoryKey?: string;

    @IsString()
    @IsOptional()
    public nodeTypeKey?: string;

    /**
     * Key that binds a node definition to a concrete implementation (data-source provider name,
     * AI model id, etc.). Only meaningful for SOURCE / AI categories.
     */
    @IsString()
    @IsOptional()
    public providerKey?: string;

    /** PrimeIcons class suffix or full class (e.g. `pi-globe`). */
    @IsString()
    @IsOptional()
    @MaxLength(120)
    public icon?: string;

    @IsString()
    @IsOptional()
    @MaxLength(2048)
    public imageUrl?: string;

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

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => NodeConnectionPointDto)
    public inputs: NodeConnectionPointDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => NodeConnectionPointDto)
    public outputs: NodeConnectionPointDto[];

    @IsArray()
    @IsIn(NODE_KIND_VALUES, { each: true })
    @IsOptional()
    public allowedSourceKinds?: NodeKind[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    public allowedSourceNodeTypeKeys?: string[];

    @IsArray()
    @IsIn(NODE_KIND_VALUES, { each: true })
    @IsOptional()
    public allowedTargetKinds?: NodeKind[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    public allowedTargetNodeTypeKeys?: string[];

    @IsObject()
    @IsOptional()
    public configSchema?: Record<string, unknown>;

    @IsEnum(BuilderNodeExecutionRole)
    public executionRole: BuilderNodeExecutionRole;

    @IsBoolean()
    public defaultRequired: boolean;

    @IsInt()
    @Min(1)
    @IsOptional()
    public timeoutMs?: number;

    @ValidateNested()
    @Type(() => RetryPolicyDto)
    @IsOptional()
    public retryPolicy?: RetryPolicyDto;
}
