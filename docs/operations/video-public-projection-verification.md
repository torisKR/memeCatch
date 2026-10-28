# Public produced-video projection verification

> Historical October 13 result. The former unlisted-visible UI contract below
> was superseded locally on October 18 by a public-only forward migration and
> runtime/player guards. See `media-recovery-safety-20261018.md`. The correction
> is not yet an applied production migration; do not treat the old UI allowance
> as the current target behavior or the new local test as deployment evidence.

Date: 2026-10-13 (Asia/Seoul)

Scope: local verification of `public.public_meme_produced_videos` only. No remote or operations database was accessed.

```yaml
postgres:
  version: "17.10 (Homebrew)"
  cluster: "/private/tmp/memecatch-video-pg.W59r6y/data"
  database: "video_final_20261012_b"
  verification_socket: "/tmp"
  verification_port: 5432
  final_state: "stopped"
migration_scope:
  full_migration_replay: false
  full_predecessor_chain: false
  applied_object: "public.public_meme_produced_videos"
tests:
  contract_vitest: "14/14 passed"
  local_projection_sql: "passed in a transaction and rolled back"
```

The local projection test proved:

- A public publication with exact production/publication/approval hashes, current embed verification, valid rights, and the newest matching successful playback proof is exposed with `public_embed_verified = true`.
- An unlisted publication remains available to the UI but always has `public_embed_verified = false`.
- A private publication is excluded.
- A newer matching proof with `embedVerified = false` wins over an older successful public proof.
- A stale publication artifact hash is excluded.
- Missing `videoMetadata` remains null; the view does not substitute database timestamps, render posters, watch-page data, or private artifact data.
- API metadata is projected only from the newest normally completed, non-cache sync/monitor job bound to the same production, publication, artifact hash, and YouTube video ID.

Commands used:

```sh
pnpm vitest run supabase/video_production_pipeline_contract.test.ts
/opt/homebrew/bin/psql -h /tmp -p 5432 -d video_final_20261012_b -v ON_ERROR_STOP=1 -f supabase/tests/video_public_projection.local.sql
git diff --check -- supabase/migrations/20261012230000_video_production_pipeline.sql supabase/video_production_pipeline_contract.test.ts supabase/tests/video_public_projection.local.sql docs/operations/video-public-projection-verification.md
```

This does not claim a full migration replay, predecessor migration compatibility, pgTAP execution, or production behavior.
