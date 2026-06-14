import { Injectable, Logger } from '@nestjs/common';
import { ProviderConnector } from '../connectors/connector.interface';
import { DataSourceConnectionContract } from '../connection-contract.types';
import { ConnectionDocument } from '../../connections/schemas/connection.schema';
import { InstagramService } from '../../clients/instagram/instagram.service';

@Injectable()
export class InstagramProvider implements ProviderConnector {
  readonly providerSlug = 'instagram';
  readonly provider = 'Instagram';
  private readonly logger = new Logger(InstagramProvider.name);

  constructor(
    private readonly instagramService: InstagramService,
  ) {}

  getConnectionContract(): DataSourceConnectionContract {
    return {
      inputs: {},
      outputs: {},
    };
  }

  async execute(params: {
    inputs?: Record<string, unknown>;
    config?: Record<string, unknown>;
    definitionAsset?: Record<string, unknown>;
    connection?: ConnectionDocument;
    context: Record<string, unknown>;
    requiredByDefault?: boolean;
  }): Promise<void> {
    const { inputs = {}, connection, context, requiredByDefault = true } = params;

    if (!connection) {
      const errorMsg = 'Instagram provider requires a user-level OAuth connection';
      this.logger.error(errorMsg);
      if (requiredByDefault) {
        throw new Error(errorMsg);
      }
      context['error'] = errorMsg;
      return;
    }

    try {
      // Get access token from connection
      const accessToken = connection.oauthTokens?.accessToken;
      if (!accessToken) {
        throw new Error('No access token available for Instagram connection');
      }

      // Fetch profile
      const profile = await this.instagramService.getProfile(accessToken);
      context['profile'] = profile;

      // Fetch insights
      const period = (inputs['period'] as string) || '7';
      const insights = await this.instagramService.getInsights(
        accessToken,
        profile.id,
        period === '30' ? '30' : '7',
      );
      context['insights'] = insights;

      // Optionally fetch recent media
      const includeMedia = inputs['includeMedia'] !== false;
      if (includeMedia) {
        const mediaLimit = Number(inputs['mediaLimit']) || 10;
        const recentMedia = await this.instagramService.getRecentMedia(
          accessToken,
          profile.id,
          mediaLimit,
        );
        context['recentMedia'] = recentMedia;

        // Optionally fetch insights for each media item
        const mediaWithInsights = await Promise.all(
          recentMedia.slice(0, 5).map(async (media) => {
            try {
              const mediaInsights = await this.instagramService.getMediaInsights(accessToken, media.id);
              return { ...media, insights: mediaInsights };
            } catch (error) {
              return media;
            }
          }),
        );
        context['topMediaWithInsights'] = mediaWithInsights;
      }

      this.logger.log(`Instagram data fetched successfully for user ${profile.username}`);
    } catch (error: any) {
      const errorMsg = `Instagram provider failed: ${error.message}`;
      this.logger.error(errorMsg, error.stack);

      if (requiredByDefault) {
        throw error;
      }
      context['error'] = errorMsg;
    }
  }
}
