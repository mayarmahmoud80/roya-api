# ProvidersModule Contract

**Module path**: `src/modules/providers/providers.module.ts`
**Exported token**: `DataSourceProviderRegistry`

## What it exports

```typescript
@Module({
  imports: [SemrushModule, ScraperModule, OpenAIModule],
  providers: [
    EncryptionService,
    WebScraperProvider,
    SemrushProvider,
    OpenAIProvider,
    GoogleProvider,
    DataSourceProviderRegistry,
  ],
  exports: [DataSourceProviderRegistry],
})
export class ProvidersModule {}
```

## Registry API surface

```typescript
class DataSourceProviderRegistry {
  /** Called once by NestJS during module initialization. */
  onModuleInit(): void;

  /**
   * Register a provider. Throws ConflictException if provider name
   * already registered (enforces FR-013).
   */
  register(provider: DataSourceProvider): void;

  /**
   * Retrieve a provider by its name. Throws NotFoundException with the
   * provider name if not registered (enforces FR-002 / edge case).
   */
  get(providerName: string): DataSourceProvider;
}
```

## Provider name → implementation mapping

| `provider` string | Class | Underlying service(s) |
|-------------------|-------|-----------------------|
| `WebScraper` | `WebScraperProvider` | `ScraperService` |
| `Semrush` | `SemrushProvider` | `SemrushService` + `EncryptionService` |
| `OpenAI` | `OpenAIProvider` | stub (no-op) |
| `Google` | `GoogleProvider` | stub (no-op) |

## AnalysesModule wiring change

```
BEFORE                          AFTER
──────────────────────────────  ────────────────────────────────
imports: [                      imports: [
  OpenAIModule,                   OpenAIModule,       ← kept for generateReport
  SemrushModule,        ──►       ProvidersModule,    ← new
  ScraperModule,        removed
]                               ]
providers: [                    providers: [
  AnalysesService,                AnalysesService,
  AnalysisProcessor,              AnalysisProcessor,
  EncryptionService,    removed   ← moved to ProvidersModule
]                               ]
```

## AnalysisProcessor injection change

```
BEFORE                          AFTER
──────────────────────────────  ────────────────────────────────
private openaiService            private openaiService    ← kept
private semrushService  removed
private scraperService  removed
private encryptionService removed
                        added →  private providerRegistry: DataSourceProviderRegistry
```
