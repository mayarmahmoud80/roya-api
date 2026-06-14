/**
 * Maps published flow node `providerKey` prefix (catalog `implClass` / `providerKey`, e.g. `Browserless`)
 * to {@link Connection#providerSlug} and {@link ProviderConnector#providerSlug}.
 */
const CATALOG_IMPL_KEY_TO_PROVIDER_SLUG: Record<string, string> = {
    WebScraper: 'web-scraper',
    Browserless: 'browserless',
    Semrush: 'semrush',
    OpenAI: 'openai',
    Google: 'google',
    Instagram: 'instagram',
    LogoPicker: 'logo-picker',
    Pravatar: 'pravatar',
};

export function catalogImplKeyToProviderSlug(implKey: string): string | undefined {
    const v = CATALOG_IMPL_KEY_TO_PROVIDER_SLUG[implKey];
    return v === undefined ? undefined : v;
}
