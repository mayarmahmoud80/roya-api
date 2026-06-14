export enum BuilderAssetType {
    SCHEMA_FIELD_TYPE = 'schemaFieldType',
    DATA_SOURCE = 'dataSource',
    PROVIDER = 'provider',
    PROVIDER_SERVICE = 'providerService',
    AI_PROVIDER = 'aiProvider',
    DICTIONARY = 'dictionary',
    /** Governed node type for the dynamic report flow graph (connection points, roles, config schema). */
    NODE_DEFINITION = 'nodeDefinition',
    /** Palette grouping: localized label + branding for a {@link NodeCategory} (flow logic). */
    NODE_PALETTE_CATEGORY = 'nodePaletteCategory',
}

