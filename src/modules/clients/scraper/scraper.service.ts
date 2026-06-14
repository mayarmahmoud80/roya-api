import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const DEFAULT_SCRAPE_BASE = 'https://app.scrapingbee.com/api/v1';
const DEFAULT_GOOGLE_BASE = 'https://app.scrapingbee.com/api/v1/store/google';

@Injectable()
export class ScraperService {
    private readonly logger = new Logger(ScraperService.name);

    /** Resolve Google Store API base URL from integration baseUrl (HTML API base). */
    private getGoogleStoreUrl(baseUrl?: string): string {
        if (!baseUrl) return DEFAULT_GOOGLE_BASE;
        const normalized = baseUrl.replace(/\/$/, '');
        if (normalized.endsWith('/api/v1')) return `${normalized}/store/google`;
        return DEFAULT_GOOGLE_BASE;
    }

    async scrapeUrl(url: string, apiKey?: string, baseUrl?: string): Promise<Record<string, any>> {
        const resolvedBaseUrl = baseUrl || DEFAULT_SCRAPE_BASE;

        if (!apiKey) {
            return {
                url,
                title: `Page: ${url}`,
                meta: 'No scraper API key configured',
                text: '',
                socialLinks: [],
            };
        }

        try {
            const response = await axios.get(resolvedBaseUrl, {
                params: {
                    api_key: apiKey,
                    url,
                    render_js: false
                } 
            });
            const text = typeof response.data === 'string' ? response.data : String(response.data ?? '');
            return {
                url,
                title: '',
                meta: '',
                text,
                socialLinks: [],
            };
        } catch (err) {
            this.logger.error(`Scraper error for ${url}: ${err.message}`);
            return { url, title: '', meta: '', text: '', socialLinks: [], error: err.message };
        }
    }

    async searchBrand(brandName: string, apiKey?: string, baseUrl?: string): Promise<Record<string, any>> {
        const googleUrl = this.getGoogleStoreUrl(baseUrl);

        if (!apiKey) {
            return { brandName, results: [], note: 'No scraper API key configured' };
        }

        try {
            const response = await axios.get(googleUrl, {
                params: {
                    api_key: apiKey,
                    search: brandName,
                    search_type: 'classic',
                    light_request: true,
                },
            });
            return { brandName, results: response.data ?? [] };
        } catch (err) {
            this.logger.error(`Brand search error for ${brandName}: ${err.message}`);
            return { brandName, results: [], error: err.message };
        }
    }
}
