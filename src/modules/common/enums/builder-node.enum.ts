/**
 * Stable top-level classification of a builder node used to pick a rendering group in the
 * palette and to derive default connection rules (see NODE_CATEGORY_RULES). Each provider or
 * user-defined node definition belongs to exactly one category.
 */
export enum NodeCategory {
    INPUT = 'input',
    SOURCE = 'source',
    TRANSFORM = 'transform',
    SCHEMA = 'schema',
    AI = 'ai',
    TERMINAL = 'terminal',
}

/** Logical node family for dynamic report flow authoring and execution. */
export enum NodeKind {
    INPUT_FIELD = 'inputField',
    DATA_SOURCE = 'dataSource',
    /** Mapper & merger palette rows share this kind; discriminate via BuilderAsset {@link ND_MAPPER_DEFINITION_SLUG} / {@link ND_MERGER_DEFINITION_SLUG}. */
    TRANSFORM = 'transform',
    OUTPUT_SCHEMA = 'outputSchema',
    AI_PROVIDER = 'aiProvider',
    TERMINAL = 'terminal',
}

/** Seed/catalog slug for the mapper transform definition (`nd-mapper`). */
export const ND_MAPPER_DEFINITION_SLUG = 'nd-mapper';
/** Seed/catalog slug for the merger transform definition (`nd-merger`). */
export const ND_MERGER_DEFINITION_SLUG = 'nd-merger';

/**
 * Explicit wire values for validation (`@IsIn`) — keep in sync with {@link NodeKind}.
 * Listed here so persisted flows and admin APIs cannot drift from execution/runtime support.
 */
export const NODE_KIND_VALUES: NodeKind[] = [
    NodeKind.INPUT_FIELD,
    NodeKind.DATA_SOURCE,
    NodeKind.TRANSFORM,
    NodeKind.OUTPUT_SCHEMA,
    NodeKind.AI_PROVIDER,
    NodeKind.TERMINAL,
];

/** Palette / admin list ordering — matches frontend `CATEGORY_ORDER`. */
export const NODE_CATEGORY_SORT_ORDER: NodeCategory[] = [
    NodeCategory.INPUT,
    NodeCategory.SOURCE,
    NodeCategory.TRANSFORM,
    NodeCategory.SCHEMA,
    NodeCategory.AI,
    NodeCategory.TERMINAL,
];

export enum NodeConnectionDirection {
    INPUT = 'input',
    OUTPUT = 'output',
}

/** How a node participates in the execution DAG. */
export enum BuilderNodeExecutionRole {
    SOURCE = 'source',
    TRANSFORM = 'transform',
    SCHEMA = 'schema',
    AI = 'ai',
    TERMINAL = 'terminal',
    PASSTHROUGH = 'passthrough',
}

export enum BuilderValueType {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
    OBJECT = 'object',
    ARRAY = 'array',
    SCHEMA = 'schema',
    PROMPT = 'prompt',
    RESULT = 'result',
    ANY = 'any',
}

export enum TerminalOutputMode {
    SCHEMA_RESULT = 'schemaResult',
    AI_RESULT = 'aiResult',
    BRANCH_BUNDLE = 'branchBundle',
}

export enum MapperTransform {
    DIRECT = 'direct',
    DEFAULT_VALUE = 'defaultValue',
    FORMAT_CONVERSION = 'formatConversion',
    FILTER = 'filter',
    COMBINE_FIELDS = 'combineFields',
}

export enum FlowValidationTargetType {
    REPORT_FLOW = 'reportFlow',
    NODE_DEFINITION = 'nodeDefinition',
    PUBLISHED_SNAPSHOT = 'publishedSnapshot',
}

export enum BranchResultStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    WARNING = 'warning',
}

export enum ValidationIssueSeverity {
    ERROR = 'error',
    WARNING = 'warning',
}
