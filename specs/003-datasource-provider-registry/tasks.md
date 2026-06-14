---

description: "Task list for Datasource Provider Registry (Strategy Pattern)"
---

# Tasks: Datasource Provider Registry (Strategy Pattern)

**Input**: Design documents from `specs/003-datasource-provider-registry/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**Purpose**: Create new module directory and migration script scaffolding.

- [X] T001 Create directory structure `src/modules/providers/` with subdirectories `interfaces/`, `registry/`, and `implementations/`
- [X] T002 [P] Create migration script `scripts/migrate-report-type-datasources.ts` — connect to MongoDB, load all `DataSource` records into a `Map<provider, _id>`, load all `ReportType` records where `dataSourceIds` is empty, match each by slug keywords (`seo`/`keyword`/`backlink` → Semrush, `brand`/`competitor`/`market` → WebScraper), update `dataSourceIds`, log per-record result, exit 0 on success; script MUST be idempotent

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core abstractions that every provider and the processor depend on. MUST be
complete before any user story implementation begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `DataSourceProvider` interface at `src/modules/providers/interfaces/data-source-provider.interface.ts` — import `ServiceIntegrationDocument` from `../service-integrations/service-integration.schema`; define `readonly provider: string` field and `execute(params: { targetEntity: string; integration?: ServiceIntegrationDocument; context: Record<string, unknown> }): Promise<void>` method (no `any` types — Constitution Principle II); include JSDoc noting: (1) provider string must match `DataSource.provider` in MongoDB, (2) mutations to `context` are in-place, (3) throwing stops the loop and marks report FAILED
- [X] T004 Create `DataSourceProviderRegistry` service at `src/modules/providers/registry/data-source-provider.registry.ts` — `@Injectable()` class implementing `OnModuleInit`; private `providers = new Map<string, DataSourceProvider>()`; `register(provider)` throws `ConflictException` if name already present and calls `this.logger.log(\`Registered provider: \${provider.provider}\`)`; `get(providerName)` throws `NotFoundException` with message `No DataSourceProvider registered for '\${providerName}'`; empty `onModuleInit()` stub (providers added in US1/US2 phases)
- [X] T005 Create `ProvidersModule` skeleton at `src/modules/providers/providers.module.ts` — `@Module({ imports: [], providers: [DataSourceProviderRegistry], exports: [DataSourceProviderRegistry] })` skeleton; `EncryptionService`, individual providers, and integration module imports added in subsequent phases

**Checkpoint**: Foundation ready — `DataSourceProvider` interface and `DataSourceProviderRegistry` exist and compile. User story implementation can begin.

---

## Phase 3: User Story 1 — Analysis Executes Without Provider Conditionals (Priority: P1) 🎯 MVP

**Goal**: Replace slug-based `if` blocks in `AnalysisProcessor.processReport` with a
data-source-driven loop dispatching through the registry. Semrush and WebScraper
providers execute automatically based on `ReportType.dataSourceIds`.

**Independent Test**: Trigger an analysis job whose `ReportType` has `dataSourceIds`
referencing a Semrush and a WebScraper `DataSource` record. Confirm both providers
execute, context is populated (`domainOverview`, `scraped`), and the report reaches
`COMPLETED` — with no `if (provider === ...)` in the loop.

### Implementation for User Story 1

- [X] T006 [P] [US1] Implement `WebScraperProvider` at `src/modules/providers/implementations/web-scraper.provider.ts` — `@Injectable()`, `readonly provider = 'WebScraper'`, inject `ScraperService`; in `execute`: set `context.scraped = await scraperService.scrapeUrl(targetEntity.startsWith('http') ? targetEntity : \`https://\${targetEntity}\`)` and `context.brandSearch = await scraperService.searchBrand(targetEntity)`; emit structured Winston log `{ module: 'WebScraperProvider', operation: 'execute', durationMs, status: 'success' }` after completion
- [X] T007 [P] [US1] Implement `SemrushProvider` at `src/modules/providers/implementations/semrush.provider.ts` — `@Injectable()`, `readonly provider = 'Semrush'`, inject `SemrushService` and `EncryptionService`; in `execute`: decrypt `integration.encryptedApiKey` if present (pass `undefined` if not); set `context.domainOverview = await semrushService.getDomainOverview(targetEntity, apiKey)` and `context.keywords = await semrushService.getKeywords(targetEntity, apiKey)`; emit structured Winston log `{ module: 'SemrushProvider', operation: 'execute', durationMs, status: 'success' }`; catch block MUST NOT log the decrypted `apiKey` value
- [X] T008 [US1] Inject `WebScraperProvider` and `SemrushProvider` into `DataSourceProviderRegistry` constructor at `src/modules/providers/registry/data-source-provider.registry.ts` and register them in `onModuleInit`: `[this.webScraper, this.semrush].forEach(p => this.register(p))`
- [X] T009 [US1] Update `ProvidersModule` at `src/modules/providers/providers.module.ts` — add `SemrushModule` and `ScraperModule` to `imports`, add `EncryptionService`, `WebScraperProvider`, `SemrushProvider` to `providers` array
- [X] T010 [US1] Refactor `AnalysisProcessor.processReport` in `src/modules/analyses/analysis.processor.ts` — add `import { DataSourceDocument } from '../data-sources/data-source.schema'` at the top of the file; replace the two provider-conditional `if` blocks in `processReport` with: (1) populate `dataSourceIds` on the `reportType` query (`.populate('dataSourceIds')`), (2) build `integrationMap = new Map(integrations.map(i => [i.dataSourceId.toString(), i]))`, (3) iterate `reportType.dataSourceIds as DataSourceDocument[]`, call `providerRegistry.get(dataSource.provider).execute({ targetEntity, integration, context })`; add `// Last-write wins: providers merge into shared context — see data-model.md` comment; remove the `console.log('context', context)` debug line
- [X] T011 [US1] Add stale DataSource guard in `analysis.processor.ts` provider loop — if a populated `dataSource` entry is `null` or lacks a `provider` field, log `this.logger.warn(\`Skipping null/stale DataSource in ReportType \${reportType._id}\`)` and `continue` (FR-014)
- [X] T012 [US1] Update `AnalysesModule` at `src/modules/analyses/analyses.module.ts` — add `ProvidersModule` to `imports`; remove `SemrushModule` and `ScraperModule` from `imports`; remove `EncryptionService` from `providers`; remove `semrushService`, `scraperService`, `encryptionService` from `AnalysisProcessor` constructor injection and replace with `private readonly providerRegistry: DataSourceProviderRegistry` (import from `ProvidersModule`)

**Checkpoint**: US1 fully functional — analysis jobs dispatch through registry, no provider conditionals in loop. Verify via application logs showing `[SemrushProvider]` and `[WebScraperProvider]` entries.

---

## Phase 4: User Story 2 — New Data Source Added Without Modifying Execution Loop (Priority: P2)

**Goal**: Prove open/closed principle by adding `OpenAIProvider` and `GoogleProvider`
stubs without touching `AnalysisProcessor`. Registry grows from 2 to 4 providers.

**Independent Test**: Start the application and confirm startup logs show all 4
providers registered. Manually trigger an analysis whose `ReportType.dataSourceIds`
includes a `Google` DataSource — confirm `GoogleProvider.execute` runs (visible in
logs) with zero changes to `analysis.processor.ts`.

### Implementation for User Story 2

- [X] T013 [P] [US2] Implement `OpenAIProvider` stub at `src/modules/providers/implementations/openai.provider.ts` — `@Injectable()`, `readonly provider = 'OpenAI'`, inject `EncryptionService`; in `execute`: record `start = Date.now()`, decrypt `integration?.encryptedApiKey` if present (pass `undefined` otherwise), log `{ module: 'OpenAIProvider', operation: 'execute', durationMs: Date.now() - start, status: 'stub — no data gathered' }` and return without modifying context; catch block MUST NOT log decrypted key; re-throw on error
- [X] T014 [P] [US2] Implement `GoogleProvider` stub at `src/modules/providers/implementations/google.provider.ts` — `@Injectable()`, `readonly provider = 'Google'`, inject `EncryptionService`; in `execute`: record `start = Date.now()`, decrypt `integration?.encryptedApiKey` if present (pass `undefined` otherwise), log `{ module: 'GoogleProvider', operation: 'execute', durationMs: Date.now() - start, status: 'stub — no data gathered' }` and return without modifying context; catch block MUST NOT log decrypted key; re-throw on error
- [X] T015 [US2] Inject `OpenAIProvider` and `GoogleProvider` into `DataSourceProviderRegistry` constructor at `src/modules/providers/registry/data-source-provider.registry.ts` and add both to the `onModuleInit` registration array: `[this.webScraper, this.semrush, this.openAI, this.google].forEach(p => this.register(p))`
- [X] T016 [US2] Add `OpenAIProvider`, `GoogleProvider`, and `OpenAIModule` to `ProvidersModule` at `src/modules/providers/providers.module.ts` — add `OpenAIModule` to `imports`, add `OpenAIProvider` and `GoogleProvider` to `providers` array

**Checkpoint**: 4 providers registered at startup. New provider added with 2 file changes (new class + `providers.module.ts`) — zero changes to `analysis.processor.ts`.

---

## Phase 5: User Story 3 — API Key Decryption Works for All Key-Based Providers (Priority: P3)

**Goal**: Ensure all key-based providers decrypt correctly, pass `undefined` when no
integration exists, and never expose plaintext keys in logs.

**Independent Test**: Inspect `SemrushProvider`, `OpenAIProvider`, and `GoogleProvider`
— each must show the decrypt-or-undefined pattern in `execute`. Confirm no `apiKey`
variable is referenced in any `this.logger.error(...)` or `this.logger.warn(...)` call.

### Implementation for User Story 3

- [X] T017 [US3] Harden `SemrushProvider` error logging at `src/modules/providers/implementations/semrush.provider.ts` — add a `try/catch` block around the service calls; in the `catch`, log `{ module: 'SemrushProvider', operation: 'execute', status: 'error', error: err.message }` only — the `apiKey` variable MUST NOT appear in the log payload; re-throw the error so the processor's fail-fast policy triggers
- [X] T018 [US3] Audit `OpenAIProvider.execute` at `src/modules/providers/implementations/openai.provider.ts` — verify the catch block logs `{ module, operation, status: 'error', error: err.message }` only and contains no reference to the decrypted `apiKey` variable; verify `durationMs` is present in the success log (both implemented in T013); re-throw is in place
- [X] T019 [US3] Audit `GoogleProvider.execute` at `src/modules/providers/implementations/google.provider.ts` — same verification as T018; catch block must not expose decrypted key; `durationMs` present in log; re-throw in place

**Checkpoint**: All 3 key-based providers follow the same decrypt-or-undefined pattern. No plaintext key in any log statement across all provider files.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final wiring, export validation, and barrel file.

- [X] T020 [P] Create barrel export `src/modules/providers/index.ts` — re-export `DataSourceProvider` interface, `DataSourceProviderRegistry`, and `ProvidersModule` for clean imports from other modules
- [X] T021 Remove unused imports from `src/modules/analyses/analysis.processor.ts` — delete any remaining `import` lines for `SemrushService`, `ScraperService`, and `EncryptionService`; confirm `DataSourceDocument` import from `../data-sources/data-source.schema` is present (added in T010)
- [X] T022 [P] Run `npm run build` and confirm zero TypeScript compilation errors across `src/modules/providers/`, `src/modules/analyses/analysis.processor.ts`, and `src/modules/analyses/analyses.module.ts`
- [ ] T023 Regression smoke-test for SC-003 — with the application running against a dev/staging database that has been migrated (T002 executed): trigger one Semrush-based analysis and one WebScraper-based analysis against the same `targetEntity` used before the refactor; compare the saved `Report.data` documents to the pre-refactor output and confirm they are structurally identical; document the comparison result in a code review comment on the PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001 and T002 run in parallel
- **Foundational (Phase 2)**: Depends on T001; T003 and T004 in parallel; T005 after T003+T004
- **US1 (Phase 3)**: Depends on Phase 2 completion — BLOCKS US2 and US3
  - T006 and T007 in parallel (different files)
  - T008 depends on T006+T007 (needs both providers to exist)
  - T009 depends on T008 (module wires up providers)
  - T010 depends on T004 (needs registry `get` method)
  - T011 depends on T010 (guard added to same loop)
  - T012 depends on T009+T010+T011 (final wiring)
- **US2 (Phase 4)**: Depends on Phase 3 completion (registry pattern established)
  - T013 and T014 in parallel (different files)
  - T015 depends on T013+T014
  - T016 depends on T015
- **US3 (Phase 5)**: Depends on T007 (SemrushProvider exists), T013/T014/T018/T019 extend stubs
  - T017, T018, T019 can run in parallel (different files)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational — no dependency on US2 or US3
- **US2 (P2)**: Starts after US1 complete — extends registry without touching the loop
- **US3 (P3)**: Starts after US1 complete — T017 modifies SemrushProvider from US1; T018/T019 modify stubs from US2

### Within Each User Story

- Provider implementations before registry injection
- Registry injection before module wiring
- Module wiring before processor refactor (US1 only)

### Parallel Opportunities

- T001 + T002 (setup): different files
- T003 + T004 (foundational): different files
- T006 + T007 (US1 providers): different files
- T013 + T014 (US2 stubs): different files
- T017 + T018 + T019 (US3 hardening): different files
- T020 + T021 + T022 (polish): different files

---

## Parallel Example: User Story 1

```bash
# Launch provider implementations in parallel:
Task: "Implement WebScraperProvider in src/modules/providers/implementations/web-scraper.provider.ts"
Task: "Implement SemrushProvider in src/modules/providers/implementations/semrush.provider.ts"

# Then sequentially:
Task: "Register WebScraperProvider and SemrushProvider in DataSourceProviderRegistry"
Task: "Update ProvidersModule with providers and imports"
Task: "Refactor AnalysisProcessor.processReport loop"
Task: "Add stale DataSource guard in analysis.processor.ts"
Task: "Update AnalysesModule imports and providers"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002 in parallel)
2. Complete Phase 2: Foundational (T003–T005)
3. Complete Phase 3: US1 (T006–T012)
4. **STOP and VALIDATE**: Start app, confirm 2 providers registered; trigger analysis, inspect logs for `[WebScraperProvider]` and `[SemrushProvider]` entries; confirm no `if (provider ===` in processor
5. Run `npm run build` — zero errors

### Incremental Delivery

1. Setup + Foundational → scaffolding complete
2. US1 → registry dispatches Semrush + WebScraper → **MVP: loop is provider-driven**
3. US2 → OpenAI + Google stubs registered → **extensibility proven**
4. US3 → all key-based providers hardened → **security regression prevented**
5. Polish → build clean, barrel exports, dead import removal

---

## Notes

- `[P]` tasks operate on different files with no incomplete-task dependencies
- `[Story]` label maps each task to its user story for traceability
- The migration script (T002) is a deployment prerequisite — run it against each target environment before starting the application with the refactored processor
- `ReportType.dataSourceIds` already exists in the Mongoose schema — no schema migration needed, only a data backfill
- Context key conflicts across providers follow last-write wins; this is documented in T010 via code comment
- SC-001 (zero conditionals) is verifiable by `grep -r "source.provider ===" src/modules/analyses/` returning no results after T010
- SC-003 (regression parity) is verified manually by T023 before PR merge
- `integration` parameters in all provider implementations MUST use `ServiceIntegrationDocument | undefined` — no `any` (Constitution Principle II)
