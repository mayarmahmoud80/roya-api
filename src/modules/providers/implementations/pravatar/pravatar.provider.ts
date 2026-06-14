import { Injectable, Logger } from '@nestjs/common';
import { DataSourceProvider } from '../../interfaces/data-source-provider.interface';
import { PravatarService } from '../../../clients/pravatar/pravatar.service';
import {
    getRequiredInputPortKeysFromBuilderAsset,
    requireTrimmedStringAtPort,
} from '../../../common/utils/provider-node-inputs';
import { PRAVATAR_CONNECTION_CONTRACT } from '../../contracts/data-source-contracts';

@Injectable()
export class PravatarProvider implements DataSourceProvider {
  readonly provider = 'Pravatar';
  private readonly logger = new Logger(PravatarProvider.name);

  constructor(
    private readonly pravatarService: PravatarService,
  ) {}

  getConnectionContract() {
    return PRAVATAR_CONNECTION_CONTRACT;
  }

  async execute(params: Parameters<DataSourceProvider['execute']>[0]): Promise<void> {
    const { context, inputs, definitionAsset } = params;
    const requiredInputKeys = getRequiredInputPortKeysFromBuilderAsset(definitionAsset);
    if (!requiredInputKeys.length) {
      throw new Error(
        `${this.provider}: node definition must declare required inputs (metadata.requiredInputKeys or required nodeDefinition.inputs).`,
      );
    }
    const seedPort = PRAVATAR_CONNECTION_CONTRACT.inputs.seed;
    if (!seedPort) {
      throw new Error(`${this.provider}: connection contract must declare input 'seed'.`);
    }
    const seed = requireTrimmedStringAtPort(inputs, seedPort.key, this.provider);
    const startTime = Date.now();
    try {
      const avatar = await this.pravatarService.getPravatar(seed);
      context[PRAVATAR_CONNECTION_CONTRACT.outputs.payload.key] = avatar;
      this.logger.log({
        module: 'PravatarProvider',
        operation: 'execute',
        durationMs: Date.now() - startTime,
        status: 'success',
      });
    } catch (err: unknown) {
      this.logger.error({
        module: 'PravatarProvider',
        operation: 'execute',
        status: 'error',
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
