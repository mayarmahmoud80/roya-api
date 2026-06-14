/**
 * Hybrid port resolution for provider-bound node definitions.
 * 
 * JSON for source node definitions stores only metadata (slug, name, providerKey, etc.)
 * without `inputs`/`outputs`. At seed time, this helper resolves ports from the live
 * contracts in the providers module, preserving the coupling with data-source-contracts.ts.
 */
import type { DataSourceConnectionContract } from '../../../modules/providers/connection-contract.types';
import {
    connectionPortsToSeedPortShapes,
    WEB_SCRAPER_CONNECTION_CONTRACT,
    BROWSERLESS_CONNECTION_CONTRACT,
    PRAVATAR_CONNECTION_CONTRACT,
    LOGO_PICKER_CONNECTION_CONTRACT,
    SEMRUSH_CONNECTION_CONTRACT,
    OPENAI_DATASOURCE_CONNECTION_CONTRACT,
} from '../../../modules/providers/contracts/data-source-contracts';

const PROVIDER_KEY_TO_CONTRACT: Record<string, DataSourceConnectionContract> = {
    WebScraper: WEB_SCRAPER_CONNECTION_CONTRACT,
    Browserless: BROWSERLESS_CONNECTION_CONTRACT,
    Pravatar: PRAVATAR_CONNECTION_CONTRACT,
    LogoPicker: LOGO_PICKER_CONNECTION_CONTRACT,
    Semrush: SEMRUSH_CONNECTION_CONTRACT,
    OpenAI: OPENAI_DATASOURCE_CONNECTION_CONTRACT,
};

export function resolveProviderPorts(providerKey: string): {
    inputs: Array<Record<string, unknown>>;
    outputs: Array<Record<string, unknown>>;
} {
    const contract = PROVIDER_KEY_TO_CONTRACT[providerKey];
    if (!contract) {
        throw new Error(`Missing contract for providerKey '${providerKey}'`);
    }
    return {
        inputs: connectionPortsToSeedPortShapes(contract.inputs),
        outputs: connectionPortsToSeedPortShapes(contract.outputs),
    };
}
