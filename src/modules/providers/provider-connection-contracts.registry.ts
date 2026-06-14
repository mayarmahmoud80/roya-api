import type { DataSourceConnectionContract } from './connection-contract.types';
import {
    BROWSERLESS_CONNECTION_CONTRACT,
    GOOGLE_DATASOURCE_CONNECTION_CONTRACT,
    INSTAGRAM_CONNECTION_CONTRACT,
    LOGO_PICKER_CONNECTION_CONTRACT,
    OPENAI_DATASOURCE_CONNECTION_CONTRACT,
    PRAVATAR_CONNECTION_CONTRACT,
    SEMRUSH_CONNECTION_CONTRACT,
    WEB_SCRAPER_CONNECTION_CONTRACT,
} from './contracts/data-source-contracts';

/** Provider keys with a code-defined connection contract (matches `DataSource.provider` / node `providerKey`). */
const DATA_SOURCE_CONTRACT_BY_PROVIDER: Record<string, DataSourceConnectionContract> = {
    WebScraper: WEB_SCRAPER_CONNECTION_CONTRACT,
    Browserless: BROWSERLESS_CONNECTION_CONTRACT,
    Semrush: SEMRUSH_CONNECTION_CONTRACT,
    LogoPicker: LOGO_PICKER_CONNECTION_CONTRACT,
    Pravatar: PRAVATAR_CONNECTION_CONTRACT,
    OpenAI: OPENAI_DATASOURCE_CONNECTION_CONTRACT,
    Google: GOOGLE_DATASOURCE_CONNECTION_CONTRACT,
    Instagram: INSTAGRAM_CONNECTION_CONTRACT,
};

export function hasDataSourceConnectionContract(providerKey: string): boolean {
    return Boolean(providerKey && DATA_SOURCE_CONTRACT_BY_PROVIDER[providerKey]);
}

export function getDataSourceConnectionContract(providerKey: string): DataSourceConnectionContract | null {
    if (!providerKey) return null;
    return DATA_SOURCE_CONTRACT_BY_PROVIDER[providerKey] ?? null;
}
