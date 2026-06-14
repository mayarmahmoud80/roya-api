import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EncryptionService } from '../../../common/services/encryption.service';
import {
    getRequiredInputPortKeysFromBuilderAsset,
    requireTrimmedStringAtPort,
} from '../../../common/utils/provider-node-inputs';
import { BROWSERLESS_CONNECTION_CONTRACT } from '../../contracts/data-source-contracts';
import { DataSourceProvider } from '../../interfaces/data-source-provider.interface';
import { DataSourceConnectionContract } from '../../connection-contract.types';

const DEFAULT_BROWSERLESS_BASE = 'https://production-sfo.browserless.io';
const CONTENT_TIMEOUT_MS = 120_000;

@Injectable()
export class BrowserlessProvider implements DataSourceProvider {
    public readonly provider = 'Browserless';

    private readonly logger = new Logger(BrowserlessProvider.name);

    public constructor(
        private readonly encryptionService: EncryptionService,
        private readonly configService: ConfigService,
    ) {}

    public getConnectionContract() {
        return BROWSERLESS_CONNECTION_CONTRACT as DataSourceConnectionContract;
    }

    public async execute(params: Parameters<DataSourceProvider['execute']>[0]): Promise<void> {
        const start = Date.now();
        const { integration, context, inputs, definitionAsset } = params;

        const requiredInputKeys = getRequiredInputPortKeysFromBuilderAsset(definitionAsset);
        if (!requiredInputKeys.length) {
            throw new Error(
                `${this.provider}: node definition must declare required inputs (metadata.requiredInputKeys or required nodeDefinition.inputs).`,
            );
        }
        const websiteUrlPort = (BROWSERLESS_CONNECTION_CONTRACT as DataSourceConnectionContract).inputs.websiteUrl;
        if (!websiteUrlPort) {
            throw new Error(`${this.provider}: node definition must declare required input 'websiteUrl'.`);
        }
        const websiteUrl = requireTrimmedStringAtPort(inputs, websiteUrlPort.key, this.provider);

        const tokenFromIntegration = integration?.encryptedApiKey
            ? this.encryptionService.decrypt(integration.encryptedApiKey)
            : undefined;
        const tokenFromEnv =
            this.configService.get<string>('BROWSERLESS_TOKEN') ??
            this.configService.get<string>('BROWSERLESS_API_TOKEN');
        const token = (tokenFromIntegration ?? tokenFromEnv)?.trim();
        if (!token) {
            throw new Error(
                `${this.provider}: Browserless API token is required (org ServiceIntegration API key or BROWSERLESS_TOKEN / BROWSERLESS_API_TOKEN).`,
            );
        }

        const baseUrl = this.resolveBaseUrl();
        const html = await this.fetchRenderedHtml(websiteUrl, token, baseUrl);

        context[(BROWSERLESS_CONNECTION_CONTRACT as DataSourceConnectionContract).outputs.payload.key] =  html ;
        context[(BROWSERLESS_CONNECTION_CONTRACT as DataSourceConnectionContract).outputs.html.key] = html;

        this.logger.log({
            module: 'BrowserlessProvider',
            operation: 'execute',
            durationMs: Date.now() - start,
            status: 'success',
        });
    }

    private resolveBaseUrl(): string {
        const raw =
            this.configService.get<string>('BROWSERLESS_BASE_URL') ??
            this.configService.get<string>('browserless.baseUrl');
        const base = (raw?.trim() || DEFAULT_BROWSERLESS_BASE).replace(/\/$/, '');
        return base;
    }

    private async fetchRenderedHtml(pageUrl: string, token: string, baseUrl: string): Promise<string> {
        const url = pageUrl.startsWith('http://') || pageUrl.startsWith('https://') ? pageUrl : `https://${pageUrl}`;
        const endpoint = `${baseUrl}/content`;

        try {
            const response = await axios.post<string>(
                endpoint,
                { url },
                {
                    params: { token },
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache',
                    },
                    responseType: 'text',
                    timeout: CONTENT_TIMEOUT_MS,
                    transitional: { forcedJSONParsing: false },
                },
            );
            const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
            return html;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (axios.isAxiosError(err) && err.response?.data) {
                const body =
                    typeof err.response.data === 'string'
                        ? err.response.data
                        : JSON.stringify(err.response.data);
                this.logger.error(`${this.provider}: /content failed — ${message} — ${body.slice(0, 500)}`);
            } else {
                this.logger.error(`${this.provider}: /content failed — ${message}`);
            }
            throw new Error(`${this.provider}: failed to fetch rendered HTML for ${url}: ${message}`);
        }
    }
}
