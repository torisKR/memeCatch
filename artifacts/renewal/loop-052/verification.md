# Loop 052 verification — global Plus saved-meme rising alerts

Date: 2026-08-08

## Acceptance evidence

- Migration source: `supabase/migrations/20260808113000_plus_saved_meme_rising_alerts.sql`
  - `saved_rising` is a constrained alert kind.
  - fan-out derives recipients from active Plus accounts and their own `saved_memes` rows.
  - saved memes are excluded from generic category candidates, preserving one alert per meme/run.
  - user limit (15), `(user_id, meme_id, kind)` idempotency, 30-day cleanup, RLS self-read, and
    service-role-only fan-out remain intact.
- `/premium` queries only the signed-in account's `saved_memes` count and sends no collection/note
  metadata to the client component.
- Trend history and alert inbox now render `PREMIUM_COPY` for all supported UI locales (ko/en/ja/zh
  base translations; existing fallback elsewhere). SEO-localized meme detail links retain their locale prefix.
- Independent review found and closed these defects: Plus gate on POST read mark, truthful copy for the
  30-day dedupe window, unique chart gradient IDs, and the missing pg_cron connection for fan-out.

## Commands

| Command | Result |
| --- | --- |
| `pnpm test` | PASS — 85 files, 680 tests |
| `npx tsc --noEmit` | PASS |
| `pnpm lint` | PASS — 0 errors; 7 pre-existing warnings |
| `pnpm build` | PASS — Next.js 16.2.10 production build |
| `node scripts/translation-batch-check.test.mjs` + `node scripts/translate-memes-mlx-linked.test.mjs` | PASS — legacy and source-snapshot offline-batch guards |
| `pnpm translation:check` | PASS — 448/1,520 offline rows; selected 8-row batch is 8/8 complete |
| `SMOKE_BASE_URL=http://localhost:3100 pnpm smoke` | PASS — 6/6; `SEO-001` soft-404 stays an acknowledged warning |
| `pnpm quality:check` | Expected non-zero — live source data has critical quality findings; no data was changed by this loop. Snapshot copied as `data-quality-report.json`. |
| `supabase db lint --local` | Not run — local Postgres connection failed because Docker daemon was unavailable. |

## Production boundary

No migration, cron, production data write, deploy, push, or merge was performed. Before enabling the feature,
apply the migration through the approved production migration process, allow the next scheduled pulse to run,
and verify active Plus, expired/free, duplicate saved/category, and RLS scenarios against the live database.
