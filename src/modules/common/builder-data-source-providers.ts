/**
 * Maps builder data-source asset slugs to concrete `DataSource.provider` values used by
 * the runtime executor when a flow node has no explicit `providerKey`. This shim exists
 * purely for backward compatibility with snapshots published before node definitions
 * carried a `providerKey`; new definitions should declare `providerKey` directly.
 */
export const BUILDER_DATA_SOURCE_SLUG_TO_PROVIDER: Record<string, string> = {
    'web-scraper': 'WebScraper',
    'logo-picker': 'LogoPicker',
    'semrush-keywords': 'Semrush',
    'openai-research': 'OpenAI',
};
