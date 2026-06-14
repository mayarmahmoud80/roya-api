import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { DataSourceType } from '../common/enums/data-source-type.enum';
import { AuthType } from '../common/enums/auth-type.enum';
import { DataSourceKind } from '../common/enums/data-source-kind.enum';
import { AuthScope } from '../common/enums/auth-scope.enum';
import { ProviderCategory } from '../common/enums/provider-category.enum';
import { CatalogSource } from '../common/enums/catalog-source.enum';

export type DataSourceDocument = DataSource & Document;

/**
 * OAuth2 settings on a data source. Client id and secret are stored encrypted
 * (`EncryptionService` / `ENCRYPTION_KEY`); endpoints and scopes are plain.
 */
export interface DataSourceOAuthConfig {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    responseType: 'code';
    grantType: 'authorization_code';
    /** Ciphertext from EncryptionService.encrypt (`ivHex:cipherHex`). */
    encryptedClientId: string;
    /** Ciphertext from EncryptionService.encrypt (`ivHex:cipherHex`). */
    encryptedClientSecret: string;
}

@Schema({ timestamps: true })
export class DataSource {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    slug: string;

    @Prop({ required: true })
    providerSlug: string;

    @Prop({ enum: Object.values(DataSourceType) })
    type?: DataSourceType;

    @Prop()
    description?: string;

    @Prop({ type: Object })
    connectionContract?: Record<string, unknown>;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ required: true })
    provider: string;

    @Prop({ enum: Object.values(DataSourceKind), default: DataSourceKind.EXTERNAL })
    kind: DataSourceKind;

    @Prop()
    baseEndpoint?: string;

    @Prop({ enum: Object.values(AuthType) })
    authType?: AuthType;

    @Prop({ type: Object })
    oauthConfig?: DataSourceOAuthConfig;

    @Prop({ default: false })
    requiredByDefault: boolean;

    /** Flow-builder / palette key; empty for pure OAuth-catalog seeds. */
    @Prop({ required: false, unique: false })
    providerKey?: string;

    /** Code binding for {@link DataSourceProviderRegistry} (`codeMap` class name). */
    @Prop()
    implClass?: string;

    /** Same role as OAuth seed `Provider.connectorClass` (often equals `implClass`). */
    @Prop()
    connectorClass?: string;

    @Prop({ enum: Object.values(ProviderCategory) })
    category?: ProviderCategory;

    /** How end users hold credentials (connections). */
    @Prop({ enum: Object.values(AuthScope), default: AuthScope.ORGANIZATION })
    authScope?: AuthScope;

    @Prop()
    icon?: string;

    @Prop()
    imageUrl?: string;

    @Prop({ enum: Object.values(CatalogSource) })
    catalogSource?: CatalogSource;
}

export const DataSourceSchema = SchemaFactory.createForClass(DataSource);

DataSourceSchema.index({ providerSlug: 1 });
DataSourceSchema.index({ slug: 1 }, { unique: true });
DataSourceSchema.index({ provider: 1 });
DataSourceSchema.index({ providerKey: 1 }, { unique: true, sparse: true });
