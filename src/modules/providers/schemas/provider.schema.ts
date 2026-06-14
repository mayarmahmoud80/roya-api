import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { AuthType } from '../../common/enums/auth-type.enum';
import { AuthScope } from '../../common/enums/auth-scope.enum';
import { ProviderCategory } from '../../common/enums/provider-category.enum';

export type ProviderDocument = Provider & Document;

export interface OAuthConfig {
    authorizationUrl: string;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scopes: string[];
    responseType: 'code';
    grantType: 'authorization_code';
}

@Schema({ collection: 'providers', timestamps: true })
export class Provider {
    @Prop({ required: false, unique: false })
    slug: string;

    @Prop({ required: true })
    displayName: string;

    @Prop()
    description?: string;

    @Prop({ enum: Object.values(ProviderCategory) })
    category?: ProviderCategory;

    @Prop({ enum: Object.values(AuthType), default: AuthType.NONE })
    authType: AuthType;

    @Prop({ enum: Object.values(AuthScope), default: AuthScope.SYSTEM })
    authScope: AuthScope;

    @Prop({ type: Object })
    oauthConfig?: OAuthConfig;

    @Prop()
    connectorClass?: string;

    @Prop()
    icon?: string;

    @Prop()
    imageUrl?: string;

    @Prop({ default: true })
    isEnabled: boolean;
}

export const ProviderSchema = SchemaFactory.createForClass(Provider);

// Sparse unique index: only documents with slug are indexed (allows multiple null slugs)
ProviderSchema.index({ slug: 1 }, { unique: true, sparse: true });
ProviderSchema.index({ category: 1 });
ProviderSchema.index({ isEnabled: 1 });
