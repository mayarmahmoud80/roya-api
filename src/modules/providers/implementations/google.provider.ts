import { Injectable, Logger } from '@nestjs/common';
import { EncryptionService } from '../../common/services/encryption.service';
import { optionalTrimmedStringAtPort } from '../../common/utils/provider-node-inputs';
import { DataSourceConnectionContract } from '../connection-contract.types';
import { GOOGLE_DATASOURCE_CONNECTION_CONTRACT } from '../contracts/data-source-contracts';
import { DataSourceProvider } from '../interfaces/data-source-provider.interface';

@Injectable()
export class GoogleProvider implements DataSourceProvider {
  public readonly provider = 'Google';
  private readonly logger = new Logger(GoogleProvider.name);

  public constructor(private readonly encryptionService: EncryptionService) {}

  public getConnectionContract(): DataSourceConnectionContract {
    return GOOGLE_DATASOURCE_CONNECTION_CONTRACT;
  }

  public async execute(params: Parameters<DataSourceProvider['execute']>[0]): Promise<void> {
    const start = Date.now();
    const { integration, inputs } = params;
    const trigger = optionalTrimmedStringAtPort(inputs, GOOGLE_DATASOURCE_CONNECTION_CONTRACT.inputs.trigger.key);

    try {
      if (integration?.encryptedApiKey) {
        this.encryptionService.decrypt(integration.encryptedApiKey);
      }

      this.logger.log({
        module: 'GoogleProvider',
        operation: 'execute',
        durationMs: Date.now() - start,
        status: 'stub — no data gathered',
        triggerPresent: Boolean(trigger),
      });
      await Promise.resolve();
    } catch (err) {
      this.logger.error({
        module: 'GoogleProvider',
        operation: 'execute',
        status: 'error',
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
