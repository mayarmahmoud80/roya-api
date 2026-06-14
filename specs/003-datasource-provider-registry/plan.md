# Implementation Plan: Datasource Provider Registry (Strategy Pattern)

**Branch**: `003-datasource-provider-registry` | **Date**: 2026-03-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-datasource-provider-registry/spec.md`

## Summary

Refactor `AnalysisProcessor` to replace slug-based provider conditionals with a
Strategy Pattern. A new `ProvidersModule` houses `DataSourceProviderRegistry` and
four `DataSourceProvider` implementations (WebScraper, Semrush, OpenAI stub, Google
stub). The processor loop iterates `ReportType.dataSourceIds`, resolves each
DataSource from MongoDB, finds the org's matching `ServiceIntegration`, and dispatches
to the registered provider. A one-time migration script back-fills `dataSourceIds` on
existing `ReportType` records from slug keyword patterns.

## Technical Context

**Language/Version**: TypeScript, Node.js 20.x
**Primary Dependencies**: NestJS 10, Mongoose, `@nestjs/bull`, Winston (all existing)
**Storage**: MongoDB via Mongoose — `ReportType.dataSourceIds` already exists
**Testing**: Jest (`@nestjs/testing`)
**Target Platform**: Linux server (Docker)
**Project Type**: Web service (REST API background processor)
**Performance Goals**: Equivalent to current — sequential provider dispatch per report
**Constraints**: Zero new npm packages; fail-fast on provider error
**Scale/Scope**: 4 providers at launch; extensible to N without loop changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate Question | Status |
|---|-----------|---------------|--------|
| I | Module-First Architecture | New `ProvidersModule` at `src/modules/providers/`. Cross-module deps declared via NestJS `imports` only (`ProvidersModule` → `SemrushModule`, `ScraperModule`, `OpenAIModule`). | ✅ |
| II | Type-Safe API Contracts | No new HTTP routes in this feature. `DataSourceProvider` interface is fully typed. No `any` in registry or provider signatures (except the `integration` param which mirrors the existing loosely-typed `ServiceIntegrationDocument`). | ✅ |
| III | Security by Default | No new routes added. `EncryptionService.decrypt` used inside providers; decrypted key never logged (FR-015). | ✅ |
| IV | Observability Required | FR-012 requires each provider to emit structured Winston log entries with `module`, `operation`, `durationMs`, `status`. Registry logs each registration. | ✅ |
| V | Simplicity and YAGNI | Registry pattern justified by 4 concrete use-cases (4 providers). No new npm packages. Constructor injection chosen over custom token pattern (simpler for current scale). | ✅ |

**Post-design re-check**: All gates still pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/003-datasource-provider-registry/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── data-source-provider.interface.ts
│   └── providers-module.contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/modules/providers/                          ← NEW module
├── interfaces/
│   └── data-source-provider.interface.ts       ← DataSourceProvider contract
├── registry/
│   └── data-source-provider.registry.ts        ← DataSourceProviderRegistry service
├── implementations/
│   ├── web-scraper.provider.ts                 ← wraps ScraperService
│   ├── semrush.provider.ts                     ← wraps SemrushService + EncryptionService
│   ├── openai.provider.ts                      ← stub (no-op)
│   └── google.provider.ts                      ← stub (no-op)
└── providers.module.ts

src/modules/analyses/
└── analysis.processor.ts                       ← MODIFIED: remove if blocks, inject registry

scripts/
└── migrate-report-type-datasources.ts          ← NEW: back-fill ReportType.dataSourceIds
```

**Structure Decision**: Single NestJS project (existing structure). New `providers`
module at `src/modules/providers/` is the sole new directory. No new top-level
directories. `AnalysesModule` modified to import `ProvidersModule` and drop direct
injection of `SemrushService`, `ScraperService`, `EncryptionService`.

## Complexity Tracking

> No Constitution Check violations — table not required.

## Implementation Notes

### DataSourceProviderRegistry

```typescript
@Injectable()
export class DataSourceProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(DataSourceProviderRegistry.name);
  private readonly providers = new Map<string, DataSourceProvider>();

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

  register(provider: DataSourceProvider): void {
    if (this.providers.has(provider.provider)) {
      throw new ConflictException(
        `Provider '${provider.provider}' is already registered in DataSourceProviderRegistry`,
      );
    }
    this.providers.set(provider.provider, provider);
    this.logger.log(`Registered provider: ${provider.provider}`);
  }

  get(providerName: string): DataSourceProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new NotFoundException(
        `No DataSourceProvider registered for '${providerName}'`,
      );
    }
    return provider;
  }
}
```

### Refactored processReport loop

```typescript
// Replace the slug-based if blocks with:
const reportType = await this.reportTypeModel
  .findById(report.reportTypeId)
  .populate('dataSourceIds')
  .exec();

const integrations = await this.integrationModel
  .find({ organizationId: new Types.ObjectId(organizationId) })
  .exec();

const integrationMap = new Map(
  integrations.map(i => [i.dataSourceId.toString(), i]),
);

for (const dataSource of (reportType.dataSourceIds as DataSourceDocument[])) {
  const integration = integrationMap.get((dataSource._id as Types.ObjectId).toString());
  const provider = this.providerRegistry.get(dataSource.provider);
  await provider.execute({ targetEntity, integration, context });
}
```

### SemrushProvider pattern (key-based providers)

```typescript
@Injectable()
export class SemrushProvider implements DataSourceProvider {
  readonly provider = 'Semrush';
  private readonly logger = new Logger(SemrushProvider.name);

  constructor(
    private readonly semrushService: SemrushService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async execute({ targetEntity, integration, context }) {
    const start = Date.now();
    const apiKey = integration?.encryptedApiKey
      ? this.encryptionService.decrypt(integration.encryptedApiKey)
      : undefined;

    context.domainOverview = await this.semrushService.getDomainOverview(targetEntity, apiKey);
    context.keywords = await this.semrushService.getKeywords(targetEntity, apiKey);

    this.logger.log({
      module: 'SemrushProvider',
      operation: 'execute',
      durationMs: Date.now() - start,
      status: 'success',
    });
  }
}
```

### Migration script outline

```typescript
// scripts/migrate-report-type-datasources.ts
const SLUG_TO_PROVIDER: Record<string, string[]> = {
  Semrush: ['seo', 'keyword', 'backlink'],
  WebScraper: ['brand', 'competitor', 'market'],
};

// 1. Connect to MongoDB
// 2. Load all DataSource records, build Map<provider, _id>
// 3. Load all ReportType records where dataSourceIds is empty
// 4. For each ReportType, find matching providers by slug keywords
// 5. Update dataSourceIds with the matching DataSource _ids
// 6. Log result per record; exit 0 on success
```
