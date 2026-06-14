import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SemrushService {
    private readonly logger = new Logger(SemrushService.name);
    private readonly baseUrl = 'https://api.semrush.com';

    private getApiKey(orgApiKey?: string): string {
        return orgApiKey || '';
    }

    async getDomainOverview(domain: string, orgApiKey?: string): Promise<Record<string, any>> {
        const apiKey = this.getApiKey(orgApiKey);
        if (!apiKey) {
            return { domain, traffic: 0, authority: 0, note: 'No Semrush API key configured' };
        }

        try {
            const response = await axios.get(`${this.baseUrl}/`, {
                params: {
                    type: 'domain_ranks',
                    key: apiKey,
                    domain,
                    database: 'us',
                    export_columns: 'Or,Ot,Oc,Ad,At,Ac',
                },
            });
            return { domain, raw: response.data };
        } catch (err) {
            this.logger.error(`Semrush domain overview error: ${err.message}`);
            return { domain, traffic: 'N/A', authority: 'N/A', error: err.message };
        }
    }

    async getKeywords(domain: string, orgApiKey?: string): Promise<Record<string, any>> {
        const apiKey = this.getApiKey(orgApiKey);
        if (!apiKey) {
            return { domain, keywords: [], note: 'No Semrush API key configured' };
        }

        try {
            const response = await axios.get(`${this.baseUrl}/`, {
                params: {
                    type: 'domain_organic',
                    key: apiKey,
                    domain,
                    database: 'us',
                    display_limit: 10,
                },
            });
            return { domain, keywords: response.data };
        } catch (err) {
            this.logger.error(`Semrush keywords error: ${err.message}`);
            return { domain, keywords: [], error: err.message };
        }
    }

    async getBacklinks(domain: string, orgApiKey?: string): Promise<Record<string, any>> {
        const apiKey = this.getApiKey(orgApiKey);
        if (!apiKey) {
            return { domain, backlinks: 0, note: 'No Semrush API key configured' };
        }

        try {
            const response = await axios.get(`${this.baseUrl}/`, {
                params: {
                    type: 'backlinks_overview',
                    key: apiKey,
                    target: domain,
                    target_type: 'root_domain',
                },
            });
            return { domain, backlinks: response.data };
        } catch (err) {
            this.logger.error(`Semrush backlinks error: ${err.message}`);
            return { domain, backlinks: 0, error: err.message };
        }
    }
}
