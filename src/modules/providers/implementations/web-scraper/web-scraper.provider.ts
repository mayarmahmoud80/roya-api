import { Injectable, Logger } from '@nestjs/common';
import { EncryptionService } from '../../../common/services/encryption.service';
import {
    getRequiredInputPortKeysFromBuilderAsset,
    requireTrimmedStringAtPort,
} from '../../../common/utils/provider-node-inputs';
import { ScraperService } from '../../../clients/scraper/scraper.service';
import { WEB_SCRAPER_CONNECTION_CONTRACT } from '../../contracts/data-source-contracts';
import { DataSourceProvider } from '../../interfaces/data-source-provider.interface';
import {
    WebScraperExecutionResult,
} from './web-scraper.io';

@Injectable()
export class WebScraperProvider implements DataSourceProvider {
  public readonly provider = 'WebScraper';

  private readonly logger = new Logger(WebScraperProvider.name);

  public constructor(
    private readonly scraperService: ScraperService,
    private readonly encryptionService: EncryptionService,
  ) {}

  public getConnectionContract() {
    return WEB_SCRAPER_CONNECTION_CONTRACT;
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
    const websiteUrlPort = WEB_SCRAPER_CONNECTION_CONTRACT.inputs.websiteUrl;
    if (!websiteUrlPort) {
      throw new Error(`${this.provider}: node definition must declare required input 'websiteUrl'.`);
    }
    const websiteUrl = requireTrimmedStringAtPort(inputs, websiteUrlPort.key, this.provider);
    const apiKey = integration?.encryptedApiKey
      ? this.encryptionService.decrypt(integration.encryptedApiKey)
      : undefined;
    const result = await this.scrape(websiteUrl, apiKey);
    context[WEB_SCRAPER_CONNECTION_CONTRACT.outputs.payload.key] = result.scraped;
    context[WEB_SCRAPER_CONNECTION_CONTRACT.outputs.html.key] = result.html;

    this.logger.log({
      module: 'WebScraperProvider',
      operation: 'execute',
      durationMs: Date.now() - start,
      status: 'success',
    });
  }

  /**
   * Integration-only work: no port keys, no `context` — easy to test and reuse.
   */
  private async scrape(
    websiteUrl: string,
    apiKey: string | undefined
  ): Promise<WebScraperExecutionResult> {
    const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
    const scraped = await this.scraperService.scrapeUrl(url, apiKey);
    const html = typeof scraped?.text === 'string' ? scraped.text : '';
    return { scraped, html };
  }
}
