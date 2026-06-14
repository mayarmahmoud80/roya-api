# Research: Datasource Provider Registry (Strategy Pattern)

**Branch**: `003-datasource-provider-registry`
**Date**: 2026-03-15

---

## 1. ReportType.dataSourceIds — Schema Already Exists

**Decision**: No Mongoose schema change required for `ReportType`.

**Rationale**: `report-type.schema.ts` already declares:
```typescript
@Prop({ type: [Types.ObjectId], ref: 'DataSource' })
dataSourceIds: Types.ObjectId[];
```
The field exists but is unpopulated on existing records. Only a data migration
(seed script) is needed — no schema migration.

**Alternatives considered**: Adding a new `dataSources` field — rejected; the
existing `dataSourceIds` array already serves this exact purpose.

---

## 2. NestJS DI Pattern for Provider Registry

**Decision**: Registry uses constructor injection + `OnModuleInit` to register
all known providers at startup.

**Rationale**: The simplest NestJS-idiomatic approach. The registry receives each
provider class as a constructor argument, then calls `this.register(provider)` for
each in `onModuleInit()`. Duplicate detection (`FR-012`) runs during registration.
No custom injection tokens or factory patterns are needed at this stage.

```typescript
@Injectable()
export class DataSourceProviderRegistry implements OnModuleInit {
  constructor(
    private readonly webScraper: WebScraperProvider,
    private readonly semrush: SemrushProvider,
    private readonly openAI: OpenAIProvider,
    private readonly google: GoogleProvider,
  ) {}

  onModuleInit() {
    [this.webScraper, this.semrush, this.openAI, this.google]
      .forEach(p => this.register(p));
  }
}
```

**Alternatives considered**:
- Multi-provider injection token (`PROVIDE: DATA_SOURCE_PROVIDERS`) — more flexible
  but adds indirection without a third use case. Can be adopted later.
- Each provider self-registers via `onModuleInit` — creates circular dependency
  risk; registry must exist first.

---

## 3. Module Placement and Import Boundaries

**Decision**: New `src/modules/providers/` module. `AnalysesModule` imports
`ProvidersModule` and keeps its own `OpenAIModule` import.

**Rationale**:
- `ProvidersModule` imports `SemrushModule`, `ScraperModule`, and `OpenAIModule`
  to access the underlying services for each provider implementation.
- `AnalysesModule` still needs `OpenAIService` for the final `generateReport` call
  (not a data-gathering step — this stays in the processor). NestJS handles multiple
  modules importing the same dependency cleanly.
- `EncryptionService` moves from `AnalysesModule.providers` into `ProvidersModule`,
  where it is consumed by key-based providers. `AnalysesModule` no longer needs it
  directly after the refactor.

**Module dependency graph after refactor**:
```
AnalysesModule
  ├── ProvidersModule (exports DataSourceProviderRegistry)
  │     ├── SemrushModule  (exports SemrushService)
  │     ├── ScraperModule  (exports ScraperService)
  │     └── OpenAIModule   (exports OpenAIService — used by OpenAIProvider stub)
  └── OpenAIModule         (exports OpenAIService — used by AnalysisProcessor.generateReport)
```

---

## 4. Provider Execution Loop Change in AnalysisProcessor

**Decision**: Replace slug-based `if` blocks with a data-source-driven loop that
populates `dataSourceIds` from `ReportType` and dispatches to the registry.

**Current pattern** (to remove):
```typescript
if (slug.includes('seo') || ...) {
  const integration = integrations.find(i => i.dataSourceId?.provider === 'Semrush');
  ...
}
```

**New pattern**:
```typescript
const reportType = await this.reportTypeModel
  .findById(report.reportTypeId)
  .populate('dataSourceIds')
  .exec();

const integrations = await this.integrationModel
  .find({ organizationId: new Types.ObjectId(organizationId) })
  .exec();

const integrationMap = new Map(
  integrations.map(i => [i.dataSourceId.toString(), i])
);

for (const dataSource of (reportType.dataSourceIds as DataSourceDocument[])) {
  const integration = integrationMap.get((dataSource._id as Types.ObjectId).toString());
  const provider = this.providerRegistry.get(dataSource.provider);
  await provider.execute({ targetEntity, integration, context });
}
```

Fail-fast on provider error is preserved by the existing `try/catch` in
`processReport` — no change to error handling structure.

---

## 5. Migration Script Strategy

**Decision**: A standalone Node/ts-node script at
`scripts/migrate-report-type-datasources.ts`.

**Rationale**: The migration maps slug keywords to DataSource provider names already
present in MongoDB. It queries DataSource records by `provider` name, then updates
each ReportType's `dataSourceIds` array based on its slug. Script is idempotent
(skips records where `dataSourceIds` is already populated).

**Slug → Provider mapping** (derived from current `analysis.processor.ts` conditionals):

| Slug keywords | DataSource provider |
|---------------|---------------------|
| seo, keyword, backlink | Semrush |
| brand, competitor, market | WebScraper |

**Alternatives considered**: Mongoose schema `default` function — rejected; defaults
only apply to new documents and cannot back-fill existing records.

---

## 6. Google and OpenAI Providers — Stub Strategy

**Decision**: Both implemented as `@Injectable()` classes that write a no-op entry
to context (empty object merge). They log a "stub — no data gathered" message.

**Rationale**: Proves extensibility (SC-002) without introducing dead code paths
that execute external calls. Stubs are easily replaced when data-gathering logic
is needed.

---

## 7. No New npm Packages Required

**Decision**: Zero new dependencies.

**Rationale**: All required building blocks exist — NestJS DI, Mongoose, existing
service classes, `EncryptionService`. Constitution Principle V (YAGNI) satisfied.
