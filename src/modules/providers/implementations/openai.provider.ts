import { Injectable, Logger } from '@nestjs/common';
import { DataSourceProvider } from '../interfaces/data-source-provider.interface';
import { EncryptionService } from '../../common/services/encryption.service';
import {
    getRequiredInputPortKeysFromBuilderAsset,
    optionalTrimmedStringAtPort,
    requireTrimmedStringAtPort,
} from '../../common/utils/provider-node-inputs';
import { OPENAI_DATASOURCE_CONNECTION_CONTRACT } from '../contracts/data-source-contracts';

@Injectable()
export class OpenAIProvider implements DataSourceProvider {
  readonly provider = 'OpenAI';
  private readonly logger = new Logger(OpenAIProvider.name);

  constructor(private readonly encryptionService: EncryptionService) {}

  getConnectionContract() {
    return OPENAI_DATASOURCE_CONNECTION_CONTRACT;
  }

  async execute(params: Parameters<DataSourceProvider['execute']>[0]): Promise<void> {
    const start = Date.now();
    const { integration, inputs, definitionAsset } = params;

    try {
      const requiredInputKeys = getRequiredInputPortKeysFromBuilderAsset(definitionAsset);
      if (!requiredInputKeys.length) {
        throw new Error(
          `${this.provider}: node definition must declare required inputs (metadata.requiredInputKeys or required nodeDefinition.inputs).`,
        );
      }
      const websiteUrlPort = OPENAI_DATASOURCE_CONNECTION_CONTRACT.inputs.websiteUrl;
      if (!websiteUrlPort) {
        throw new Error(`${this.provider}: connection contract must declare input 'websiteUrl'.`);
      }
      requireTrimmedStringAtPort(inputs, websiteUrlPort.key, this.provider);
      const brandKey = OPENAI_DATASOURCE_CONNECTION_CONTRACT.inputs.brandName.key;
      const brandName = optionalTrimmedStringAtPort(inputs, brandKey);

      if (integration?.encryptedApiKey) {
        this.encryptionService.decrypt(integration.encryptedApiKey);
      }

      this.logger.log({
        module: 'OpenAIProvider',
        operation: 'execute',
        durationMs: Date.now() - start,
        status: 'stub — no data gathered',
        brandPresent: Boolean(brandName),
      });
    } catch (err) {
      this.logger.error({
        module: 'OpenAIProvider',
        operation: 'execute',
        status: 'error',
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
