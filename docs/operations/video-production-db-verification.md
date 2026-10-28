# Video production database verification

Verified: 2026-10-12; local test server stopped: 2026-10-13 (Asia/Seoul).

```yaml
postgres:
  version: "17.10 (Homebrew)"
  socket: "/private/tmp/memecatch-video-pg.W59r6y"
  port: 55439
  database: "video_final_20261012_b"
  scope: "isolated local temporary cluster"
  server_running: false
  data_retained: "/private/tmp/memecatch-video-pg.W59r6y/data"
bootstrap:
  kind: "minimal compatibility schema"
  full_predecessor_migrations: false
  saved_replayable_bootstrap: false
  includes:
    - auth.uid/auth.jwt role shims
    - profiles and operator check
    - meme/source/claim/report/content base tables used by this migration
    - storage bucket/object base tables
migration:
  file: "supabase/migrations/20261012230000_video_production_pipeline.sql"
  result: "the pre-monitor revision applied cleanly; the final settings/columns delta was applied and every changed function was recompiled from final source"
  final_full_file_replay: false
  final_full_file_replay_blocker: "the original minimal compatibility bootstrap SQL was not retained; reconstructing a substitute would not prove the same dependency/order surface"
tests:
  vitest: "13/13 passed"
  isolated_postgres_flows: "passed"
  pgtap_assertions_authored: 60
  pgtap_executed: false
  pgtap_blocker: "pgtap.control is not installed in the isolated PostgreSQL 17 runtime"
```

Verified database behavior:

- Candidate listing is read-only; explicit reservation atomically consumes candidate/draft capacity.
- Repeating the same operator's unconsumed reservation returns the same snapshot without double consumption.
- Draft creation stores the server-built source snapshot; reviewed source IDs and optimistic versions fail closed.
- Rights reviewers are rebound to the authenticated operator. Render completion validates and stores voice/font/graphic asset bindings and narration/font SHA-256 evidence.
- Lease-token render completion, `changes_requested`, OAuth state single-use, and secret-output rejection work as declared.
- Publication queue records upload consent. A resumable upload intent may exist before the external POST with a null session URI, but upload completion requires a persisted URI, a started chunk, and exact final byte offset.
- Repeating an existing publication request returns the locked ledger unchanged and never creates another upload. Two concurrent first requests returned the same publication ID and produced one publication plus one upload job.
- Retry resumes upload only when a durable session exists without a video ID, and queues a status check when a video ID exists.
- Provider Retry-After is bounded to 24 hours and wins over the local exponential backoff when later.
- Site linking schedules one monitor after the configured 21,600-second delay. A healthy monitor completes its current ledger row and schedules exactly one delayed successor; a failed embed probe invalidates and unlinks the publication without recurrence.
- Processing polls are durable and bounded: 120-second polling, a 21,600-second deadline, and 24 observations by default. `failed`, `terminated`, upload rejection, and deadline exhaustion become terminal `unavailable` states instead of polling forever.
- An authoritative status check that resolves an ambiguous publish to the approved visibility transitions to `published`, enqueues exactly one hash-bound sync, links the site, and starts monitoring.
- Cache-only sync can complete/fail after blocking without changing production/publication state.
- Remote disappearance, visibility withdrawal, rights expiry, and invalid monitor observations atomically invalidate the publication ledger before removing public projections.
- A rights-expiry failure with an exact publication/job/approved-artifact binding and a YouTube video ID atomically queues one hash-bound withdrawal. Monitor and sync failures share the same path, active-job uniqueness prevents duplicates, and a stale input hash cannot authorize withdrawal.

The database does not create a cron scheduler. A continuously running worker/watch process must keep claiming due `video_production_jobs`; otherwise delayed checks and monitors remain durably queued but do not execute.

The task-owned local PostgreSQL server was shut down after verification. Its data files were preserved; no production database was contacted. The following read-only queries require restarting that exact isolated cluster first and are not evidence of a currently running database:

```sh
/opt/homebrew/bin/psql -h /private/tmp/memecatch-video-pg.W59r6y -p 55439 -d video_final_20261012_b -Atqc "select current_setting('server_version')"
/opt/homebrew/bin/psql -h /private/tmp/memecatch-video-pg.W59r6y -p 55439 -d video_final_20261012_b -Atqc "select count(*) from public.video_productions; select count(*) from public.youtube_publications;"
pnpm vitest run supabase/video_production_pipeline_contract.test.ts
git diff --check -- supabase/migrations/20261012230000_video_production_pipeline.sql supabase/video_production_pipeline_contract.test.ts supabase/tests/video_production_pipeline.sql docs/operations/video-production-db-verification.md
```

The SQL pgTAP file is ready for a Supabase/PostgreSQL environment with pgTAP installed. It was not reported as executed locally.
