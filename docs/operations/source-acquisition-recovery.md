# Source acquisition recovery

## Migration ordering

Apply `20260912010000_source_acquisition_recovery.sql` after the source-ingestion migrations:

1. `20260723120000_source_pipeline.sql`
2. `20260824190000_source_ingestions.sql`
3. `20260824203000_atomic_source_ingestion.sql`
4. `20260912010000_source_acquisition_recovery.sql`

Local runtime verification:

```sh
scripts/source-acquisition-recovery.runtime.test.sh
```

This starts an isolated PostgreSQL 17 cluster under `/tmp`, creates minimal stub
`media_sources` and `is_operator()` prerequisites, applies only this migration, and
destroys the cluster on exit. It does not use Supabase credentials or production data.

The migration creates recovery state and failure history without inserting rows into
`media_sources`, `meme_media`, `meme_sources`, or `meme_contents`. It is therefore safe
for failed provider attempts that never produced a normalized media source.

## Runtime contract

`record_source_acquisition_failure` is service-role-only and accepts a caller-owned
idempotency key. Repeating the same key returns `recorded = false` and does not advance
the attempt counter. Failure ordering is `(attempted_at, idempotency_key)`; the timestamp
is the attempt-start timestamp supplied by the caller, and the key breaks ties.
`resolve_source_acquisition_failure` must identify the successful attempt's idempotency
key and start timestamp. A stale success cannot resolve a newer failure. Existing
callers that omit this context now fail closed with
`source_recovery_resolution_context_required` until they pass the attempt context.

Retryable errors use a deterministic five-minute exponential schedule capped at 24 hours.
The persisted recovery attempt count drives the next retry delay; callers must not use a
stale local attempt number to overwrite current state. Historical failure rows are kept
even when their event is too old to replace current recovery state.
Permanent and uncertain errors have no next retry time. The application supplies the
clock timestamp, so unit tests do not depend on wall-clock time.

## Rollback limits

Do not roll back this migration by dropping either table while application code can call
the recovery RPCs. First deploy the integration rollback that stops those calls, then
remove the RPC grants and tables in a later migration. Dropping the tables deletes
failure history and recovery state; it does not restore provider metadata or public
projection rows. A forward corrective migration is preferred when history must be kept.
