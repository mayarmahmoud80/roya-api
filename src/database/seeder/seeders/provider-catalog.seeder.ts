import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DataSource, DataSourceDocument } from '../../../modules/data-sources/data-source.schema';
import { OAuthConfig } from '../../../modules/providers/schemas/provider.schema';
import { EncryptionService } from '../../../modules/common/services/encryption.service';
import { CatalogSource } from '../../../modules/common/enums/catalog-source.enum';
import providerCatalog from '../data/provider-catalog.json';

@Injectable()
export class ProviderCatalogSeeder {
    private readonly logger = new Logger(ProviderCatalogSeeder.name);

    constructor(
        @InjectModel(DataSource.name)
        private readonly dataSourceModel: Model<DataSourceDocument>,
        private readonly encryptionService: EncryptionService,
    ) {}

    async seed(): Promise<void> {
        for (const providerData of providerCatalog) {
            const p: any = { ...providerData };
            const $set: Record<string, unknown> = {
                connectorClass: p.connectorClass,
                implClass: p.implClass ?? p.connectorClass,
                category: p.category,
                authType: p.authType,
                authScope: p.authScope,
                description: p.description,
                isActive: p.isEnabled !== false,
                catalogSource: CatalogSource.OAUTH,
            };

            if (p.authType === 'oauth2') {
                const oauth = this.getOAuthConfig(p.slug);
                if (oauth) {
                    $set.oauthConfig = {
                        authorizationUrl: oauth.authorizationUrl,
                        tokenUrl: oauth.tokenUrl,
                        scopes: oauth.scopes,
                        responseType: 'code',
                        grantType: 'authorization_code',
                        encryptedClientId: this.encryptionService.encrypt(oauth.clientId.trim()),
                        encryptedClientSecret: this.encryptionService.encrypt(oauth.clientSecret.trim()),
                    };
                }
            }

            await this.dataSourceModel
                .updateOne({ providerSlug: p.slug }, { $set })
                .exec();
        }

        this.logger.log('Merged OAuth provider catalog fields into DataSource rows (by providerSlug)');
    }

    private getOAuthConfig(providerSlug: string): OAuthConfig | undefined {
        const slug = providerSlug.toUpperCase().replace('-', '_');
        const clientId = process.env[`${slug}_CLIENT_ID`];
        const clientSecret = process.env[`${slug}_CLIENT_SECRET`];

        if (!clientId || !clientSecret) {
            this.logger.warn(`OAuth config missing for ${providerSlug} (no CLIENT_ID or CLIENT_SECRET)`);
            return undefined;
        }

        const oauthUrls: Record<string, { authUrl: string; tokenUrl: string; scopes: string[] }> = {
            instagram: {
                authUrl: 'https://api.instagram.com/oauth/authorize',
                tokenUrl: 'https://api.instagram.com/oauth/access_token',
                scopes: ['user_profile', 'user_media'],
            },
            google: {
                authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                tokenUrl: 'https://oauth2.googleapis.com/token',
                scopes: ['https://www.googleapis.com/auth/userinfo.profile'],
            },
        };

        const urls = oauthUrls[providerSlug];
        if (!urls) {
            this.logger.warn(`OAuth URLs not defined for provider ${providerSlug}`);
            return undefined;
        }

        return {
            authorizationUrl: urls.authUrl,
            tokenUrl: urls.tokenUrl,
            clientId,
            clientSecret,
            scopes: urls.scopes,
            responseType: 'code',
            grantType: 'authorization_code',
        };
    }
}
