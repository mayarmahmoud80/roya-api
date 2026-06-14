# Feature Specification: Datasource Provider Registry (Strategy Pattern)

**Feature Branch**: `003-datasource-provider-registry`
**Created**: 2026-03-15
**Status**: Draft
**Input**: Refactor datasource execution logic to Strategy Pattern with Provider Registry

## Clarifications

### Session 2026-03-15

- Q: How does the loop determine which providers to invoke for a given report? → A: ReportType document holds the list of required DataSource IDs; the loop iterates those specific data sources, finds the org's matching integration for each, and dispatches to the registered provider.
- Q: If one provider fails mid-loop, does the report fail immediately or continue with partial results? → A: Fail fast — the first provider failure stops execution and marks the report FAILED.
- Q: Where does the DataSourceProviderRegistry live in the module structure? → A: New dedicated `src/modules/providers/` module, imported by the `analyses` module.
- Q: How are existing ReportType records migrated to carry the new `dataSources` field? → A: A one-time migration script is included in this feature to back-fill `dataSources` on all existing ReportType records using the current slug-to-provider mapping.
- Q: In what order are providers executed when a ReportType lists multiple data sources? → A: Insertion order of the `dataSources` array on the ReportType document; the array order is the execution order.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Analysis Executes Without Provider Conditionals (Priority: P1)

A developer triggers an analysis job. The system processes each data source by
dispatching to the correct registered provider automatically — no conditional checks
in the execution loop. The analysis result is identical to what the current system
produces.

**Why this priority**: This is the core correctness requirement. If the registry
dispatches correctly and output is unchanged, the refactor is successful. All other
stories build on this.

**Independent Test**: Trigger an analysis job whose ReportType lists Semrush and
WebScraper as required data sources. Confirm both providers execute, context is
populated, and the report is saved as COMPLETED — without any `if (provider === ...)`
branches in the loop.

**Acceptance Scenarios**:

1. **Given** an analysis job with a ReportType that lists a Semrush DataSource as
   required, **When** the job is processed, **Then** the Semrush provider is invoked,
   domain overview data is added to context, and the report reaches COMPLETED status.
2. **Given** an analysis job with a ReportType that lists a WebScraper DataSource as
   required, **When** the job is processed, **Then** the Scraper provider is invoked,
   scraped content is added to context, and the report reaches COMPLETED status.
3. **Given** an analysis job whose ReportType lists a DataSource whose provider name
   has no registered handler, **When** the job is processed, **Then** the report
   reaches FAILED status with a clear error message identifying the unrecognized
   provider name.

---

### User Story 2 - New Data Source Added Without Modifying Execution Loop (Priority: P2)

A developer needs to support a new data source (e.g., Google Search Console). They
create a new provider class, register it, and the execution loop picks it up
automatically with zero changes to the processor.

**Why this priority**: Extensibility is the primary architectural goal. Validating
this story proves the open/closed principle is satisfied.

**Independent Test**: Add a stub `GoogleProvider` that appends a known value to
context. Add a Google DataSource record to a ReportType's required list. Confirm the
provider executes without touching the execution loop.

**Acceptance Scenarios**:

1. **Given** a new provider class is created and registered, **When** an analysis job
   targets a ReportType that lists the new DataSource, **Then** the provider's execute
   logic runs and its output appears in context — with no changes to the main
   processing loop.
2. **Given** the registry has N providers, **When** a new provider is registered,
   **Then** the registry contains N+1 providers and the new one is retrievable by name.

---

### User Story 3 - API Key Decryption Works for All Key-Based Providers (Priority: P3)

When a Semrush, OpenAI, or Google integration has an encrypted API key stored in the
database, the corresponding provider decrypts it before calling the external service.
The decrypted key is never exposed in logs or error messages.

**Why this priority**: Ensures the refactor does not regress the existing secure
key-handling behaviour.

**Independent Test**: Run an analysis with a Semrush integration that has an encrypted
key. Confirm the external call receives the correct plaintext key, and no plaintext
key value appears in application logs.

**Acceptance Scenarios**:

1. **Given** a Semrush integration with an encrypted API key, **When** the Semrush
   provider executes, **Then** it decrypts the key and passes the plaintext value to
   the Semrush service — the encrypted form is never sent to the external API.
2. **Given** a provider requires an API key but no matching integration exists for
   the organisation, **When** that provider executes, **Then** the operation proceeds
   with `undefined` as the key, matching current behaviour.
3. **Given** a provider executes and any error occurs, **Then** no plaintext API key
   value appears in the logged error message.

---

### Edge Cases

- What happens when the registry is asked for a provider name that has no registered
  handler? The processor MUST catch this, mark the report FAILED, and log the
  unrecognized provider name.
- What happens when two providers attempt to register under the same name? The
  registry MUST throw at startup (registration time), not silently at runtime.
- What happens when the context object is mutated by multiple providers for the same
  report? Each provider merges its output into the shared context; last-write wins is
  acceptable and MUST be documented in code comments.
- What happens when one provider fails mid-loop? The execution MUST stop immediately,
  the report MUST be marked FAILED, and no subsequent providers are invoked. Partial
  context is discarded and not passed to the AI report generator.
- What happens when an integration record exists but `encryptedApiKey` is null or
  empty? The provider MUST pass `undefined` to the downstream service, matching
  current behaviour.
- What happens when a ReportType lists a DataSource ID that no longer exists in
  MongoDB? The loop MUST skip that entry and log a warning, not fail the entire report.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define a `DataSourceProvider` contract with a `provider`
  name field and an `execute(params)` method accepting `targetEntity`, optional
  `integration` typed as `ServiceIntegrationDocument | undefined` (no `any`), and
  `context` typed as `Record<string, unknown>`.
- **FR-002**: The system MUST provide a `DataSourceProviderRegistry` that stores
  providers by name, exposes a `register` method, and a `get(name)` method that
  throws a descriptive error when the name is not found.
- **FR-003**: The system MUST implement a `WebScraperProvider` encapsulating the
  current scrape-URL and brand-search logic (previously in the `brand`/`competitor`/
  `market` slug conditional).
- **FR-004**: The system MUST implement a `SemrushProvider` encapsulating the current
  domain-overview and keyword-fetch logic (previously in the `seo`/`keyword`/
  `backlink` slug conditional), including API key decryption.
- **FR-005**: The system MUST implement an `OpenAIProvider` registered in the registry
  following the `DataSourceProvider` contract. As no OpenAI data-gathering logic
  currently exists, the initial implementation is a no-op stub that logs its
  invocation and returns without modifying context. It MUST include API key decryption
  via `EncryptionService` so it is ready for future data-gathering logic without
  further interface changes.
- **FR-006**: The system MUST implement a `GoogleProvider` as a registered, injectable
  provider following the same contract (initially a no-op stub if no Google
  data-gathering logic currently exists).
- **FR-007**: All providers MUST be registered in the registry via dependency
  injection — no manual instantiation with `new`.
- **FR-008**: The analysis execution loop MUST call the provider from the registry and
  invoke its `execute` method instead of provider-conditional `if` blocks.
- **FR-009**: The `ReportType` document MUST carry a list of required DataSource IDs.
  The execution loop iterates this list, resolves each DataSource record from MongoDB,
  finds the organisation's matching integration, and dispatches to the corresponding
  registered provider.
- **FR-010**: Data sources MUST continue to be loaded from MongoDB and integrations
  MUST continue to be mapped by `dataSourceId` before provider dispatch.
- **FR-011**: The `context` object MUST remain mutable across provider calls within a
  single report execution, allowing providers to contribute incrementally.
- **FR-012**: Each provider MUST emit a structured log entry covering at minimum the
  provider name, operation performed, and outcome (success or failure).
- **FR-013**: Duplicate provider registration (same provider name registered twice)
  MUST be rejected at startup with an error, not silently overwritten.
- **FR-014**: If a DataSource ID listed on a ReportType no longer exists in MongoDB,
  the loop MUST skip that entry with a warning log and continue processing remaining
  data sources.
- **FR-015**: If any provider throws during `execute`, the execution loop MUST stop
  immediately, re-throw the error, and mark the report FAILED. Subsequent providers
  in the loop MUST NOT be invoked.
- **FR-016**: The `DataSourceProviderRegistry`, the `DataSourceProvider` contract, and
  all provider implementations (WebScraper, Semrush, OpenAI, Google) MUST reside in a
  new dedicated `src/modules/providers/` module. The `analyses` module imports
  `ProvidersModule` to access the registry in the processor.
- **FR-017**: This feature MUST include a one-time migration script that back-fills
  the `dataSources` field on all existing ReportType records, mapping each record's
  slug patterns to the corresponding DataSource IDs (matching the current slug-based
  conditional logic). The migration MUST be idempotent and MUST run before the
  refactored processor is deployed.
- **FR-018**: The execution loop MUST iterate the `ReportType.dataSources` array in
  insertion order. Providers MUST execute sequentially in that order. The array order
  on the ReportType document is the authoritative execution sequence.

### Key Entities

- **DataSourceProvider**: The contract every data-source handler implements.
  Identified by a `provider` string matching the `provider` field on the DataSource
  record in MongoDB.
- **DataSourceProviderRegistry**: A singleton service holding the provider map. Acts
  as the sole source of truth for which providers are available at runtime.
- **ReportType**: An existing MongoDB document describing a report template. Now
  carries a `dataSources` field — an array of DataSource IDs that the execution loop
  iterates to determine which providers to invoke.
- **ServiceIntegration**: An existing database record linking an organisation to a
  data source. Carries an encrypted API key and a `dataSourceId` reference. Passed
  as `integration` to the provider's `execute` method.
- **ExecutionContext**: The plain key-value object accumulated during a single report
  run. Providers write their gathered data into it; the AI report generator reads
  from it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The analysis execution loop contains zero provider-name conditional
  statements after the refactor, verifiable by code inspection.
- **SC-002**: Adding a new data source provider requires creating exactly one new
  class and one registration call — zero changes to the execution loop or any other
  existing file.
- **SC-003**: All existing analysis jobs (Semrush-based, Scraper-based) produce
  identical report output before and after the refactor, verified by the existing test
  suite without modifying test assertions.
- **SC-004**: The registry detects and rejects duplicate provider registrations at
  application startup, preventing silent overwrites.
- **SC-005**: No plaintext API key value appears in any log entry produced by a
  provider, verifiable by log inspection during a test run with a known key.

## Assumptions

- The `ReportType` document in MongoDB will be extended with a `dataSources` array
  field. A one-time migration script (included in this feature) back-fills this field
  on all existing records using the current slug-to-provider mapping. The migration
  runs before the refactored processor is deployed.
- The `GoogleProvider` has no active data-gathering logic today; it is scaffolded as a
  registered stub to prove extensibility.
- Context key conflicts between providers (last-write wins) are acceptable and will be
  documented in code comments.
- The registry is module-scoped and initialized at application startup via dependency
  injection, so no lazy registration is needed.
- Provider execution order follows the insertion order of `ReportType.dataSources`.
  Ordering correctness is the responsibility of whoever populates that array (migration
  script for existing records, content tooling for new ones).
