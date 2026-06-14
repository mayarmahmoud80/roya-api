/** Origin of a row in the unified datasources catalog (provider + datasource config). */
export enum CatalogSource {
  /** Seeded OAuth-style catalog metadata (historically `providers` with `slug`). */
  OAUTH = 'oauth',
  /** Flow-builder palette row (`providerKey` + `implClass`). */
  BUILDER = 'builder',
  /** Merged row updated from both sources / manual admin edits. */
  UNIFIED = 'unified',
}
