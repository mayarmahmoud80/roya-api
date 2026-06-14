import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OAuthConfig } from '../../providers/schemas/provider.schema';
import {
    DataSource,
    DataSourceDocument,
    DataSourceOAuthConfig,
} from '../../data-sources/data-source.schema';
import { AuthType } from '../../common/enums/auth-type.enum';
import { EncryptionService } from '../../common/services/encryption.service';

export interface OAuthProviderConfig extends OAuthConfig {
    providerSlug: string;
}

@Injectable()
export class OAuthConfigRegistry {
    private readonly logger = new Logger(OAuthConfigRegistry.name);
    private configs: Map<string, OAuthProviderConfig> = new Map();

    constructor(
        @InjectModel(DataSource.name)
        private readonly dataSourceModel: Model<DataSourceDocument>,
        private readonly encryptionService: EncryptionService,
    ) {}

    /**
     * Loads OAuth settings for `providerSlug` from the first matching active datasource row,
     * decrypts `oauthConfig.encryptedClientId` / `encryptedClientSecret`, caches the result, and returns it.
     */
    async getConfig(providerSlug: string): Promise<OAuthProviderConfig> {
        const cached = this.configs.get(providerSlug);
        if (cached) {
            return cached;
        }

        const row = await this.dataSourceModel
            .findOne({
                providerSlug,
                isActive: true,
                authType: AuthType.OAUTH2,
                oauthConfig: { $exists: true, $ne: null },
            })
            .sort({ slug: 1 })
            .select(['providerSlug', 'oauthConfig'])
            .lean()
            .exec();

        const template = row?.oauthConfig;
        if (!row?.providerSlug || !this.isCompleteOAuthTemplate(template)) {
            throw new NotFoundException(`No OAuth config found for provider: ${providerSlug}`);
        }

        let clientId: string;
        let clientSecret: string;
        try {
            clientId = this.encryptionService.decrypt(template.encryptedClientId).trim();
            clientSecret = this.encryptionService.decrypt(template.encryptedClientSecret).trim();
        } catch (err) {
            this.logger.warn(
                `Failed to decrypt OAuth client credentials for provider "${row.providerSlug}": ${(err as Error).message}`,
            );
            throw new NotFoundException(`No OAuth config found for provider: ${providerSlug}`);
        }
        if (!clientId || !clientSecret) {
            this.logger.warn(`OAuth provider "${row.providerSlug}" has empty client id or secret after decrypt.`);
            throw new NotFoundException(`No OAuth config found for provider: ${providerSlug}`);
        }

        const built: OAuthProviderConfig = {
            providerSlug: row.providerSlug,
            authorizationUrl: template.authorizationUrl,
            tokenUrl: template.tokenUrl,
            scopes: template.scopes,
            responseType: template.responseType,
            grantType: template.grantType,
            clientId,
            clientSecret,
        };

        this.configs.set(row.providerSlug, built);
        return built;
    }

    async hasConfig(providerSlug: string): Promise<boolean> {
        if (this.configs.has(providerSlug)) {
            return true;
        }
        try {
            await this.getConfig(providerSlug);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Provider slugs that have complete OAuth metadata (including encrypted credentials) in the database.
     */
    async getAllProviderSlugs(): Promise<string[]> {
        const rows = await this.dataSourceModel
            .find({
                isActive: true,
                authType: AuthType.OAUTH2,
                oauthConfig: { $exists: true, $ne: null },
            })
            .select(['providerSlug', 'oauthConfig'])
            .lean()
            .exec();

        const slugs = new Set<string>();
        for (const row of rows) {
            if (row.providerSlug && this.isCompleteOAuthTemplate(row.oauthConfig)) {
                slugs.add(row.providerSlug);
            }
        }
        return [...slugs].sort();
    }

    private isCompleteOAuthTemplate(o: unknown): o is DataSourceOAuthConfig {
        if (!o || typeof o !== 'object') {
            return false;
        }
        const r = o as Record<string, unknown>;
        return (
            typeof r.authorizationUrl === 'string' &&
            typeof r.tokenUrl === 'string' &&
            Array.isArray(r.scopes) &&
            r.scopes.length > 0 &&
            r.scopes.every((s) => typeof s === 'string') &&
            r.responseType === 'code' &&
            r.grantType === 'authorization_code' &&
            typeof r.encryptedClientId === 'string' &&
            r.encryptedClientId.includes(':') &&
            typeof r.encryptedClientSecret === 'string' &&
            r.encryptedClientSecret.includes(':')
        );
    }
}
