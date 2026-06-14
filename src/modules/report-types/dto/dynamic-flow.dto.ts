import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsIn,
    IsInt,
    IsMongoId,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';
import { LocalizedTextDto } from '../../common/dto/localized-text.dto';
import {
    FlowValidationTargetType,
    MapperTransform,
    NODE_KIND_VALUES,
    NodeCategory,
    NodeKind,
    TerminalOutputMode,
    ValidationIssueSeverity,
} from '../../common/enums/builder-node.enum';

function coerceLegacyFlowNodeKind(value: unknown): unknown {
    if (value === 'mapper' || value === 'merger') {
        return NodeKind.TRANSFORM;
    }
    return value;
}

export class FlowRefDto {
    @IsString()
    public nodeId: string;

    @IsString()
    public portKey: string;
}

export class MapperRuleDto {
    @IsString()
    public ruleId: string;

    @IsString()
    @IsOptional()
    public sourcePath?: string;

    @IsString()
    public targetPath: string;

    @IsEnum(MapperTransform)
    public transform: MapperTransform;

    @IsObject()
    @IsOptional()
    public parameters?: Record<string, unknown>;

    @IsBoolean()
    public required: boolean;
}

export class TerminalConfigDto {
    @IsString()
    public terminalKey: string;

    @IsBoolean()
    public required: boolean;

    @IsArray()
    @IsIn(NODE_KIND_VALUES, { each: true })
    public acceptedSourceKinds: NodeKind[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    public acceptedSourceNodeTypeKeys?: string[];

    @IsEnum(TerminalOutputMode)
    public outputMode: TerminalOutputMode;
}

export class ReportFlowNodePositionDto {
    @IsNumber()
    public x: number;

    @IsNumber()
    public y: number;
}

export class ReportFlowNodeDto {
    @IsString()
    public nodeId: string;

    @IsMongoId()
    public definitionAssetId: string;

    @Transform(({ value }) => coerceLegacyFlowNodeKind(value))
    @IsIn(NODE_KIND_VALUES)
    public nodeKind: NodeKind;

    @IsEnum(NodeCategory)
    @IsOptional()
    public category?: NodeCategory;

    @IsString()
    @IsOptional()
    public builderCategoryKey?: string;

    @IsString()
    @IsOptional()
    public nodeTypeKey?: string;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    @IsOptional()
    public labelOverride?: LocalizedTextDto;

    @IsBoolean()
    public required: boolean;

    @IsObject()
    @IsOptional()
    public config?: Record<string, unknown>;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MapperRuleDto)
    @IsOptional()
    public mapperRules?: MapperRuleDto[];

    /** Portal palette slug (`nd-merger`) when Mongo BuilderAsset.slug is missing on catalog load. */
    @IsString()
    @IsOptional()
    public definitionSlug?: string;

    @ValidateNested()
    @Type(() => TerminalConfigDto)
    @IsOptional()
    public terminalConfig?: TerminalConfigDto;

    @ValidateNested()
    @Type(() => ReportFlowNodePositionDto)
    @IsOptional()
    public position?: ReportFlowNodePositionDto;
}

export class ReportFlowConnectionDto {
    @IsString()
    public connectionId: string;

    @ValidateNested()
    @Type(() => FlowRefDto)
    public source: FlowRefDto;

    @ValidateNested()
    @Type(() => FlowRefDto)
    public target: FlowRefDto;

    @IsBoolean()
    public required: boolean;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    @IsOptional()
    public label?: LocalizedTextDto;
}

export class ReportFlowDraftInputDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReportFlowNodeDto)
    public flowNodes: ReportFlowNodeDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReportFlowConnectionDto)
    public flowConnections: ReportFlowConnectionDto[];
}

export class ValidationIssueDto {
    @IsString()
    public code: string;

    @IsString()
    public path: string;

    @IsString()
    @IsOptional()
    public nodeId?: string;

    @IsString()
    @IsOptional()
    public connectionId?: string;

    @ValidateNested()
    @Type(() => LocalizedTextDto)
    public message: LocalizedTextDto;

    @IsEnum(ValidationIssueSeverity)
    public severity: ValidationIssueSeverity;
}

export class FlowGraphStatsDto {
    @IsInt()
    @Min(0)
    public nodeCount: number;

    @IsInt()
    @Min(0)
    public connectionCount: number;

    @IsInt()
    @Min(0)
    public terminalPathCount: number;
}

export class FlowValidationResultDto {
    @IsEnum(FlowValidationTargetType)
    public targetType: FlowValidationTargetType;

    @IsMongoId()
    @IsOptional()
    public targetId?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ValidationIssueDto)
    public blockingErrors: ValidationIssueDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ValidationIssueDto)
    public warnings: ValidationIssueDto[];

    @ValidateNested()
    @Type(() => FlowGraphStatsDto)
    public graphStats: FlowGraphStatsDto;

    public checkedAt: Date;
}

export class ReportFlowDraftResponseDto extends ReportFlowDraftInputDto {
    @ValidateNested()
    @Type(() => FlowValidationResultDto)
    @IsOptional()
    public validationSummary?: FlowValidationResultDto;

    @IsArray()
    @IsOptional()
    public availableNodeDefinitions?: Record<string, unknown>[];
}
