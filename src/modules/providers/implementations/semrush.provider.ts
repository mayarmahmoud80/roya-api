import { Injectable, Logger } from '@nestjs/common';
import { DataSourceProvider } from '../interfaces/data-source-provider.interface';
import { SemrushService } from '../../clients/semrush/semrush.service';
import { EncryptionService } from '../../common/services/encryption.service';
import {
    getRequiredInputPortKeysFromBuilderAsset,
    requireTrimmedStringAtPort,
} from '../../common/utils/provider-node-inputs';
import { SEMRUSH_CONNECTION_CONTRACT } from '../contracts/data-source-contracts';

@Injectable()
export class SemrushProvider implements DataSourceProvider {
  readonly provider = 'Semrush';
  private readonly logger = new Logger(SemrushProvider.name);

  constructor(
    private readonly semrushService: SemrushService,
    private readonly encryptionService: EncryptionService,
  ) {}

  getConnectionContract() {
    return SEMRUSH_CONNECTION_CONTRACT;
  }

  async execute(params: Parameters<DataSourceProvider['execute']>[0]): Promise<void> {
    const start = Date.now();
    const { integration, context, inputs, definitionAsset } = params;

    const requiredInputKeys = getRequiredInputPortKeysFromBuilderAsset(definitionAsset);
    if (!requiredInputKeys.length) {
      throw new Error(
        `${this.provider}: node definition must declare required inputs (metadata.requiredInputKeys or required nodeDefinition.inputs).`,
      );
    }
    const websiteUrlPort = SEMRUSH_CONNECTION_CONTRACT.inputs.websiteUrl;
    if (!websiteUrlPort) {
      throw new Error(`${this.provider}: connection contract must declare input 'websiteUrl'.`);
    }
    const seed = requireTrimmedStringAtPort(inputs, websiteUrlPort.key, this.provider);

    try {
      const apiKey = integration?.encryptedApiKey
        ? this.encryptionService.decrypt(integration.encryptedApiKey)
        : undefined;
      context.domainOverview = await this.semrushService.getDomainOverview(seed, apiKey);
      context.keywords = await this.semrushService.getKeywords(seed, apiKey);

      this.logger.log({
        module: 'SemrushProvider',
        operation: 'execute',
        durationMs: Date.now() - start,
        status: 'success',
      });
    } catch (err) {
      this.logger.error({
        module: 'SemrushProvider',
        operation: 'execute',
        status: 'error',
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
