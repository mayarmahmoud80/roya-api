import { ServiceIntegrationDocument } from '../../src/modules/service-integrations/service-integration.schema';
import type { DataSourceConnectionContract } from '../../src/modules/providers/connection-contract.types';

/**
 * DataSourceProvider — the contract every data-source handler must implement.
 *
 * The `provider` string MUST exactly match the `DataSource.provider` field
 * stored in MongoDB. The registry uses it as the lookup key.
 *
 * `execute` receives the shared execution context and mutates it in-place by
 * merging gathered data. Providers MUST NOT overwrite unrelated keys set by
 * previously-executed providers; use namespaced keys (e.g., `context.payload`,
 * `context.domainOverview`) to avoid collisions.
 *
 * If execution fails, `execute` MUST throw — the processor catches this,
 * stops the loop, and marks the report FAILED (fail-fast policy).
 */
export interface DataSourceProvider {
  /**
   * Unique name matching DataSource.provider in MongoDB.
   * Examples: 'WebScraper' | 'Semrush' | 'OpenAI' | 'Google'
   */
  readonly provider: string;

  /** Declares builder ports; persisted node definitions are overwritten from this on save. */
  getConnectionContract(): DataSourceConnectionContract;

  /**
   * Gathers data from the external source and writes results into `context`.
   *
   * @param params.inputs        Dynamic parameters from wired flow ports.
   * @param params.integration   Org's ServiceIntegration record for this source.
   *                             Undefined if the organisation has no integration
   *                             configured for this data source.
   * @param params.context       Shared mutable result accumulator. Mutate in-place.
   */
  execute(params: {
    inputs?: Record<string, unknown>;
    config?: Record<string, unknown>;
    definitionAsset?: Record<string, unknown>;
    integration?: ServiceIntegrationDocument;
    context: Record<string, unknown>;
  }): Promise<void>;
}
