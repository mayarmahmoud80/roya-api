import { ConnectionDocument } from '../../connections/schemas/connection.schema';
import { DataSourceConnectionContract } from '../connection-contract.types';

/**
 * ProviderConnector — contract every provider handler must implement.
 *
 * (1) The `providerSlug` string MUST match `Provider.slug` in MongoDB (used as registry key).
 * (2) Mutations to `context` are in-place; connectors merge their output into the shared object.
 * (3) Throwing from `execute` stops the loop and marks the report FAILED (fail-fast policy).
 *
 * Recommended layout: read each input port in `execute` via `provider-node-inputs.ts`, run
 * integration logic, then write to `context`. Provider-specific I/O helpers live next to that
 * connector (e.g. `connectors/web-scraper/web-scraper.io.ts`).
 */
export interface ProviderConnector {
    /** Unique slug matching Provider.slug in MongoDB (e.g. 'web-scraper' | 'semrush'). */
    readonly providerSlug: string;

    /** Ports for flow authoring and persisted node definitions (single source of truth in code). */
    getConnectionContract(): DataSourceConnectionContract;

    /**
     * Gathers data from the external source and writes results into context.
     *
     * @param params.inputs  Values wired to the node's input ports.
     * @param params.config  Published node snapshot `config`. Optional `*InputKey` overrides for
     *   legacy snapshots when the definition asset is missing.
     * @param params.definitionAsset  Full BuilderAsset document for this node's `definitionAssetId`
     *   from the published snapshot's `nodeDefinitions` (metadata.requiredInputKeys / input ports).
     * @param params.connection   Org/user Connection for this provider, or undefined if none.
     * @param params.context       Shared mutable result accumulator; mutate in-place.
     * @param params.requiredByDefault When true, failures should fail the report; when false, connectors may soft-skip.
     */
    execute(params: {
        inputs?: Record<string, unknown>;
        config?: Record<string, unknown>;
        definitionAsset?: Record<string, unknown>;
        connection?: ConnectionDocument;
        context: Record<string, unknown>;
        requiredByDefault?: boolean;
    }): Promise<void>;
}
