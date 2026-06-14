import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomBytes } from 'crypto';
import { ConnectionsService } from '../../connections/connections.service';
import { OAuthConfigRegistry } from './oauth-config.registry';
import { ConnectionDocument } from '../../connections/schemas/connection.schema';

interface OAuthState {
    providerSlug: string;
    organizationId: string;
    userId?: string;
    scope: 'organization' | 'user';
    nonce: string;
    redirectUrl?: string;
}

@Injectable()
export class OAuthService {
    private readonly logger = new Logger(OAuthService.name);
    private stateStore: Map<string, OAuthState> = new Map();

    constructor(
        private configService: ConfigService,
        private connectionsService: ConnectionsService,
        private oauthConfigRegistry: OAuthConfigRegistry,
    ) {}

    async buildAuthorizationUrl(
        providerSlug: string,
        organizationId: string,
        userId: string | undefined,
        scope: 'organization' | 'user',
        redirectUrl?: string,
    ): Promise<string> {
        const config = await this.oauthConfigRegistry.getConfig(providerSlug);
        const state = this.generateState(providerSlug, organizationId, userId, scope, redirectUrl);
        
        const callbackUrl = this.getCallbackUrl(providerSlug);

        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: callbackUrl,
            response_type: config.responseType,
            scope: config.scopes.join(' '),
            state,
        });

        return `${config.authorizationUrl}?${params.toString()}`;
    }

    private generateState(
        providerSlug: string,
        organizationId: string,
        userId: string | undefined,
        scope: 'organization' | 'user',
        redirectUrl?: string,
    ): string {
        const nonce = randomBytes(16).toString('hex');
        const state: OAuthState = {
            providerSlug,
            organizationId,
            userId,
            scope,
            nonce,
            redirectUrl,
        };
        
        const stateKey = nonce;
        this.stateStore.set(stateKey, state);
        
        setTimeout(() => {
            this.stateStore.delete(stateKey);
        }, 10 * 60 * 1000);
        
        return stateKey;
    }

    async handleCallback(state: string, code: string): Promise<{ connection: ConnectionDocument; redirectUrl?: string }> {
        const oauthState = this.stateStore.get(state);

        if (!oauthState) {
            throw new BadRequestException('Invalid or expired OAuth state');
        }
        
        this.stateStore.delete(state);
        
        const config = await this.oauthConfigRegistry.getConfig(oauthState.providerSlug);
        const callbackUrl = this.getCallbackUrl(oauthState.providerSlug);
        
        try {
            const tokenResponse = await axios.post(
                config.tokenUrl,
                new URLSearchParams({
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    code,
                    redirect_uri: callbackUrl,
                    grant_type: config.grantType,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            const { access_token, refresh_token, expires_in, token_type } = tokenResponse.data;
            
            const expiresAt = expires_in 
                ? new Date(Date.now() + expires_in * 1000)
                : undefined;

            let connection = await this.connectionsService.findByProvider(
                oauthState.organizationId,
                oauthState.providerSlug,
                oauthState.userId,
            );

            if (connection) {
                connection = await this.connectionsService.updateOAuthTokens(
                    connection._id.toString(),
                    {
                        accessToken: access_token,
                        refreshToken: refresh_token,
                        expiresAt,
                        tokenType: token_type,
                    }
                );
            } else {
                connection = await this.connectionsService.create(oauthState.organizationId,{
                    providerSlug: oauthState.providerSlug, 
                    userId: oauthState.userId as any,
                    scope: oauthState.scope as any,
                });

                connection = await this.connectionsService.updateOAuthTokens(
                    connection._id.toString(),
                    {
                        accessToken: access_token,
                        refreshToken: refresh_token,
                        expiresAt,
                        tokenType: token_type,
                    }
                );
            }

            return {
                connection,
                redirectUrl: oauthState.redirectUrl,
            };

        } catch (error) {
            this.logger.error(`OAuth token exchange failed for ${oauthState.providerSlug}:`, error.response?.data || error.message);
            throw new UnauthorizedException('Failed to exchange authorization code for tokens');
        }
    }

    async refreshTokenIfNeeded(connection: ConnectionDocument): Promise<ConnectionDocument> {
        if (!this.connectionsService.isTokenExpired(connection)) {
            return connection;
        }

        if (!connection.oauthTokens?.refreshToken) {
            await this.connectionsService.markAsExpired(
                connection._id.toString(),
                'Token expired and no refresh token available'
            );
            throw new UnauthorizedException('OAuth token expired and cannot be refreshed');
        }

        const config = await this.oauthConfigRegistry.getConfig(
            await this.connectionsService.resolveProviderSlug(connection),
        );

        try {
            const tokenResponse = await axios.post(
                config.tokenUrl,
                new URLSearchParams({
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    refresh_token: connection.oauthTokens.refreshToken,
                    grant_type: 'refresh_token',
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            const { access_token, refresh_token, expires_in, token_type } = tokenResponse.data;
            
            const expiresAt = expires_in 
                ? new Date(Date.now() + expires_in * 1000)
                : undefined;

            const updatedConnection = await this.connectionsService.updateOAuthTokens(
                connection._id.toString(),
                {
                    accessToken: access_token,
                    refreshToken: refresh_token || connection.oauthTokens.refreshToken,
                    expiresAt,
                    tokenType: token_type,
                }
            );

            this.logger.log(`Refreshed OAuth token for connection ${connection._id}`);
            return updatedConnection;

        } catch (error) {
            this.logger.error(`Token refresh failed for connection ${connection._id}:`, error.response?.data || error.message);
            
            await this.connectionsService.markAsExpired(
                connection._id.toString(),
                'Token refresh failed'
            );
            
            throw new UnauthorizedException('Failed to refresh OAuth token');
        }
    }

    private getCallbackUrl(providerSlug: string): string {
        const baseUrl = (this.configService.get<string>('API_BASE_URL') || 'http://localhost:3000').replace(/\/+$/, '');
        const prefix = (this.configService.get<string>('API_PREFIX') || '/api/v1').replace(/\/+$/, '');
        const normalizedPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`;
        return `${baseUrl}${normalizedPrefix}/auth/oauth/${providerSlug}/callback`;
    }
}
