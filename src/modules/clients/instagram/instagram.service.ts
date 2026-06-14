import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface InstagramProfile {
  id: string;
  username: string;
  account_type: string;
  media_count: number;
}

export interface InstagramInsights {
  impressions: number;
  reach: number;
  profile_views: number;
  follower_count: number;
  website_clicks?: number;
  email_contacts?: number;
}

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: string;
  media_url: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  private readonly baseUrl = 'https://graph.instagram.com';

  async getProfile(accessToken: string): Promise<InstagramProfile> {
    try {
      const response = await axios.get(`${this.baseUrl}/me`, {
        params: {
          fields: 'id,username,account_type,media_count',
          access_token: accessToken,
        },
      });
      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to fetch Instagram profile:', error.response?.data || error.message);
      throw new Error(`Instagram API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getInsights(accessToken: string, userId: string, period: '7' | '30' = '7'): Promise<InstagramInsights> {
    try {
      const metrics = [
        'impressions',
        'reach',
        'profile_views',
        'follower_count',
        'website_clicks',
        'email_contacts',
      ];

      const response = await axios.get(`${this.baseUrl}/${userId}/insights`, {
        params: {
          metric: metrics.join(','),
          period: 'day',
          access_token: accessToken,
        },
      });

      const insights: any = {};
      response.data.data.forEach((item: any) => {
        const latestValue = item.values?.[item.values.length - 1]?.value || 0;
        insights[item.name] = latestValue;
      });

      return insights;
    } catch (error: any) {
      this.logger.error('Failed to fetch Instagram insights:', error.response?.data || error.message);
      throw new Error(`Instagram API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getRecentMedia(accessToken: string, userId: string, limit: number = 10): Promise<InstagramMediaItem[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/${userId}/media`, {
        params: {
          fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
          limit,
          access_token: accessToken,
        },
      });
      return response.data.data || [];
    } catch (error: any) {
      this.logger.error('Failed to fetch Instagram media:', error.response?.data || error.message);
      throw new Error(`Instagram API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getMediaInsights(accessToken: string, mediaId: string): Promise<Record<string, number>> {
    try {
      const metrics = ['engagement', 'impressions', 'reach', 'saved'];
      
      const response = await axios.get(`${this.baseUrl}/${mediaId}/insights`, {
        params: {
          metric: metrics.join(','),
          access_token: accessToken,
        },
      });

      const insights: any = {};
      response.data.data.forEach((item: any) => {
        insights[item.name] = item.values?.[0]?.value || 0;
      });

      return insights;
    } catch (error: any) {
      this.logger.warn(`Failed to fetch media insights for ${mediaId}:`, error.message);
      return {};
    }
  }
}
