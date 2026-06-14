import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Res,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OAuthService } from './oauth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthScope } from '../../common/enums/auth-scope.enum';
import { StartOAuthDto } from './dto/start-oauth.dto';

@Controller('auth/oauth')
@ApiTags('oauth')
export class OAuthController {
    constructor(
        private readonly oauthService: OAuthService,
        private readonly config: ConfigService,
    ) {}

    /** Absolute URL to the portal Connections page (OAuth return target). */
    private connectionsPageUrl(queryString: string): string {
        const base = (this.config.get<string>('PORTAL_URL') || 'http://localhost:4200').replace(/\/+$/, '');
        const q = queryString.startsWith('?') ? queryString.slice(1) : queryString;
        return `${base}/app/connections?${q}`;
    }

    /**
     * SPA-friendly OAuth start: HttpClient sends Bearer; response is the provider authorize URL.
     * (Browser GET to /auth/oauth/:slug cannot attach Authorization.)
     */
    @Post(':providerSlug/start')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async startOAuthForSpa(
        @Param('providerSlug') providerSlug: string,
        @CurrentUser('organizationId') organizationId: string,
        @CurrentUser('userId') userId: string,
        @Body() body: StartOAuthDto,
    ): Promise<{ authorizationUrl: string }> {
        const scopeEnum = body.scope ?? AuthScope.ORGANIZATION;
        if (scopeEnum === AuthScope.SYSTEM) {
            throw new BadRequestException('OAuth connection does not support system scope');
        }
        const scope: 'organization' | 'user' =
            scopeEnum === AuthScope.USER ? 'user' : 'organization';
        if (scope === 'user' && !userId) {
            throw new BadRequestException('User scope requires authenticated user');
        }
        const filterUserId = scope === 'user' ? userId : undefined;
        const authorizationUrl = await this.oauthService.buildAuthorizationUrl(
            providerSlug,
            organizationId,
            filterUserId,
            scope,
            body.redirectUrl,
        );
        return { authorizationUrl };
    }

    @Get(':providerSlug')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async initiateOAuth(
        @Param('providerSlug') providerSlug: string,
        @CurrentUser('organizationId') organizationId: string,
        @CurrentUser('userId') userId: string,
        @Query('scope') scope: 'organization' | 'user' = 'organization',
        @Query('redirectUrl') redirectUrl: string,
        @Res() res: Response,
    ): Promise<void> {
        if (scope === 'user' && !userId) {
            throw new BadRequestException('User scope requires authenticated user');
        }

        const filterUserId = scope === 'user' ? userId : undefined;

        const authUrl = await this.oauthService.buildAuthorizationUrl(
            providerSlug,
            organizationId,
            filterUserId,
            scope,
            redirectUrl,
        );

        return res.redirect(authUrl);
    }

    @Get(':providerSlug/callback')
    async handleCallback(
        @Param('providerSlug') providerSlug: string,
        @Query('code') code: string,
        @Query('state') state: string,
        @Query('error') error: string,
        @Query('error_description') errorDescription: string,
        @Res() res: Response,
    ) {
        if (error) {
            const redirectUrl = this.connectionsPageUrl(
                `error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || 'OAuth error')}`,
            );
            return res.redirect(redirectUrl);
        }

        if (!code || !state) {
            return res.redirect(this.connectionsPageUrl('error=missing_parameters'));
        }

        try {
            const { redirectUrl: customRedirectUrl } = await this.oauthService.handleCallback(state, code);
            
            const successUrl =
                customRedirectUrl ||
                this.connectionsPageUrl(`success=true&provider=${encodeURIComponent(providerSlug)}`);
            return res.redirect(successUrl);

        } catch (err) {
            const errorMessage = err.message || 'OAuth callback failed';
            return res.redirect(this.connectionsPageUrl(`error=${encodeURIComponent(errorMessage)}`));
        }
    }
}
