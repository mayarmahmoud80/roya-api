# Data Model: Datasource Provider Registry (Strategy Pattern)

**Branch**: `003-datasource-provider-registry`
**Date**: 2026-03-15

---

## Unchanged Schemas

The following MongoDB schemas require **no changes**:

- `DataSource` — `provider: string` field already identifies the handler name.
- `ServiceIntegration` — `dataSourceId`, `encryptedApiKey`, `config` all used as-is.
- `Analysis`, `Report`, `ReportType` Mongoose schemas — no field additions required.

> `ReportType.dataSourceIds: Types.ObjectId[]` already exists in the schema.
> Only existing **documents** need back-filling via the migration script.

---

## New In-Code Types (no MongoDB schema changes)

### DataSourceProvider (interface)

The contract every provider class implements. Lives at:
`src/modules/providers/interfaces/data-source-provider.interface.ts`

| Field / Method | Type | Description |
|----------------|------|-------------|
| `provider` | `string` | Matches `DataSource.provider` in MongoDB. Used as the registry key. |
| `execute(params)` | `Promise<void>` | Performs data gathering and writes results into `params.context`. |

**`execute` params shape**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `targetEntity` | `string` | Yes | The domain / brand being analysed (e.g., "acme.com"). |
| `integration` | `ServiceIntegrationDocument \| undefined` | No | The org's integration record for this data source. Contains `encryptedApiKey`, `oauthToken`, `config`. |
| `context` | `Record<string, any>` | Yes | Shared mutable context object. Provider merges its output into this object. |

---

### DataSourceProviderRegistry (service)

Lives at: `src/modules/providers/registry/data-source-provider.registry.ts`

| Field / Method | Type | Description |
|----------------|------|-------------|
| `providers` | `Map<string, DataSourceProvider>` | Internal store. Keyed by `provider` string. Private. |
| `register(provider)` | `void` | Adds provider to map. Throws `ConflictException` if name already registered. |
| `get(providerName)` | `DataSourceProvider` | Returns provider or throws `NotFoundException` if not found. |

**State**: Populated once during `onModuleInit`. Read-only at runtime.

---

### ExecutionContext (runtime object, not persisted)

Accumulated within a single `processReport` call. Passed by reference to all
providers in sequence. Contents depend on which providers execute.

| Key (conventional) | Set by | Value |
|--------------------|--------|-------|
| `domainOverview` | `SemrushProvider` | Semrush domain_ranks result |
| `keywords` | `SemrushProvider` | Semrush domain_organic result (if report needs it) |
| `scraped` | `WebScraperProvider` | ScrapingBee page extract |
| `brandSearch` | `WebScraperProvider` | Google brand search results |

Context is discarded after report generation; not persisted to MongoDB.

---

## Migration Artefact

**Script**: `scripts/migrate-report-type-datasources.ts`

**Purpose**: Back-fills `dataSourceIds` on existing `ReportType` documents that
have an empty array, using the slug keyword → DataSource provider mapping:

| Slug contains | DataSource.provider to link |
|---------------|----------------------------|
| `seo` OR `keyword` OR `backlink` | `Semrush` |
| `brand` OR `competitor` OR `market` | `WebScraper` |

**Idempotency rule**: Records where `dataSourceIds.length > 0` are skipped.

**Run order**: Script MUST run before deploying the refactored `AnalysisProcessor`.

---

## Module Dependency Map

```
src/modules/providers/
├── interfaces/
│   └── data-source-provider.interface.ts   ← DataSourceProvider contract
├── registry/
│   └── data-source-provider.registry.ts    ← DataSourceProviderRegistry service
├── implementations/
│   ├── web-scraper.provider.ts             ← wraps ScraperService
│   ├── semrush.provider.ts                 ← wraps SemrushService + EncryptionService
│   ├── openai.provider.ts                  ← stub (no-op for now)
│   └── google.provider.ts                  ← stub (no-op for now)
└── providers.module.ts                     ← exports DataSourceProviderRegistry
```

**Imports of ProvidersModule**:
- `SemrushModule` (provides `SemrushService`)
- `ScraperModule` (provides `ScraperService`)
- `OpenAIModule` (provides `OpenAIService` — for future `OpenAIProvider`)
- `EncryptionService` (provided directly, no dedicated module)
