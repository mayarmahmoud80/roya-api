# Quickstart: Datasource Provider Registry

**Branch**: `003-datasource-provider-registry`

---

## Prerequisites

- MongoDB running (local or via `docker-compose up`)
- `.env` configured with `DATABASE_URL`, `ENCRYPTION_KEY`, `SEMRUSH_API_KEY`,
  `SCRAPER_API_KEY`, `OPENAI_API_KEY`

---

## Step 1 — Run the migration script

Back-fill `dataSourceIds` on existing ReportType records. Run this **once**,
before starting the refactored API:

```bash
npx ts-node scripts/migrate-report-type-datasources.ts
```

Expected output:
```
[migrate] Found 3 ReportType records with empty dataSourceIds
[migrate] Linked ReportType "SEO Report" → [<semrush-ds-id>]
[migrate] Linked ReportType "Brand Report" → [<webscraper-ds-id>]
[migrate] Linked ReportType "Competitor Report" → [<webscraper-ds-id>]
[migrate] Done. 3 updated, 0 skipped.
```

Idempotent — safe to re-run; records with existing `dataSourceIds` are skipped.

---

## Step 2 — Start the API

```bash
npm run dev
```

On startup you should see the registry initialise:
```
[DataSourceProviderRegistry] Registered provider: WebScraper
[DataSourceProviderRegistry] Registered provider: Semrush
[DataSourceProviderRegistry] Registered provider: OpenAI
[DataSourceProviderRegistry] Registered provider: Google
```

---

## Step 3 — Trigger an analysis job

Submit an analysis via the existing endpoint. The processor will now iterate
`ReportType.dataSourceIds` instead of slug-based conditionals.

To verify:
1. Check application logs for `[WebScraperProvider]` or `[SemrushProvider]` entries
   showing `operation`, `durationMs`, and `status` fields.
2. Confirm the Report document reaches `status: COMPLETED` in MongoDB.

---

## Step 4 — Add a new provider (extensibility validation)

1. Create `src/modules/providers/implementations/my-new.provider.ts`:

```typescript
@Injectable()
export class MyNewProvider implements DataSourceProvider {
  readonly provider = 'MyNew';

  async execute({ targetEntity, integration, context }) {
    context.myNewData = { result: 'example' };
  }
}
```

2. Register it in `providers.module.ts`:

```typescript
providers: [..., MyNewProvider],
// in DataSourceProviderRegistry constructor: add private myNew: MyNewProvider
// in onModuleInit: this.register(this.myNew)
```

3. Add a DataSource record in MongoDB with `provider: 'MyNew'`, and link its `_id`
   to a ReportType's `dataSourceIds`.

4. Trigger an analysis for that report type — `MyNewProvider.execute` runs
   automatically. **No changes to `AnalysisProcessor`.**

---

## Duplicate registration guard (startup)

If two providers share the same `provider` name, the app will fail at startup:

```
ConflictException: Provider 'Semrush' is already registered in DataSourceProviderRegistry
```

Fix: ensure each class has a unique `readonly provider` value.

---

## Rollback

If the migration needs to be reversed (empty all `dataSourceIds`):

```javascript
// MongoDB shell
db.reporttypes.updateMany({}, { $set: { dataSourceIds: [] } })
```
