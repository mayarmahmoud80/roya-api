import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ConnectionStatus } from '../../common/enums/connection-status.enum';
import { AuthScope } from '../../common/enums/auth-scope.enum';

export type ConnectionDocument = Connection & Document;

export interface OAuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    tokenType?: string;
}

@Schema({ timestamps: true })
export class Connection {
    @Prop({ type: Types.ObjectId, ref: 'DataSource', index: true })
    dataSourceId?: Types.ObjectId;

    /** Denormalized from {@link DataSource#providerSlug} for OAuth routes and legacy lookups. */
    @Prop({ required: false })
    providerSlug?: string;

    @Prop({ type: Types.ObjectId, ref: 'Organization', index: true, required: true })
    organizationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', index: true })
    userId?: Types.ObjectId;

    @Prop({ enum: Object.values(AuthScope), required: true })
    scope: AuthScope;

    @Prop({ enum: Object.values(ConnectionStatus), default: ConnectionStatus.PENDING })
    status: ConnectionStatus;

    @Prop()
    encryptedApiKey?: string;

    @Prop({ type: Object })
    oauthTokens?: OAuthTokens;

    @Prop({ type: Object, default: {} })
    config: Record<string, any>;

    @Prop()
    lastUsedAt?: Date;

    @Prop()
    lastErrorAt?: Date;

    @Prop()
    lastErrorMessage?: string;

    @Prop()
    tokenExpiresAt?: Date;
}

export const ConnectionSchema = SchemaFactory.createForClass(Connection);

ConnectionSchema.index({ dataSourceId: 1, organizationId: 1, userId: 1 });
ConnectionSchema.index({ dataSourceId: 1, organizationId: 1, scope: 1 });
ConnectionSchema.index({ providerSlug: 1, organizationId: 1, userId: 1 });
ConnectionSchema.index({ providerSlug: 1, organizationId: 1, scope: 1 });
ConnectionSchema.index({ status: 1 });
