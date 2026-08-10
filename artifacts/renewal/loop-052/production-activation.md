# Plus saved-meme alert activation evidence — Loop 052

**Status: not executed.** No migration, cron change, RPC call, production data write, deployment, or user-alert fan-out was performed in this workspace.

## What the migration activates

`supabase/migrations/20260808113000_plus_saved_meme_rising_alerts.sql`:

1. permits `trend_alerts.kind = 'saved_rising'` alongside the existing `rising` kind;
2. replaces the service-role-only fan-out so an active Plus account receives a saved-meme signal first and never receives a duplicate category signal for that same meme in the same run;
3. keeps the existing per-user 15-result cap, uniqueness, and 30-day retention; and
4. registers `memecatch-daily-trend-alerts` for **00:35 KST** (`35 15 * * *` UTC), five minutes after `memecatch-daily-ranking` computes trend scores.

The named cron job is deliberately replaced on migration replay; it does not add a second schedule. The migration does **not** invoke the fan-out immediately, avoiding an unreviewed global user-notification write during schema activation.

## Pre-activation evidence in this workspace

- Static source-contract test: `supabase/plus_saved_meme_rising_alerts.test.ts`
  checks entitlement scope, own-save join, duplicate exclusion, bounded/idempotent writes, browser-role revocation, and the exact cron registration.
- Route contract: `app/api/trend-alerts/route.test.ts` confirms signed-out users receive 401, non-Plus users receive 403, and an active Plus member can only call the existing self-scoped read-mark RPC.
- Local Postgres verification remains unavailable: Docker daemon was not running, so `supabase db lint --local` cannot provide SQL/RLS execution evidence.

## Operator-run production verification (after authorized migration apply)

1. Confirm the migration ledger includes `20260808113000` and inspect `cron.job` for exactly one `memecatch-daily-trend-alerts` entry with schedule `35 15 * * *` and command `select public.fan_out_trend_alerts();`.
2. Wait for the next normal scheduled run; **do not manually invoke** `fan_out_trend_alerts()` because it writes alerts for every eligible user.
3. With a consenting active Plus test account that has a saved, approved/limited, recently published `rising` meme, verify one self-visible `saved_rising` alert appears after the run.
4. Verify the same saved meme does not also produce a generic `rising` alert for that account; verify no more than 15 new alerts for the account; and verify an active Plus account without interests remains eligible when it has a saved candidate.
5. With a signed-in non-Plus account, verify the alert route does not reveal alerts and `POST /api/trend-alerts` returns 403. With the Plus test account, verify the API can mark only that account's alerts read.
6. Record cron success/failure and the above results in a deployment artifact before claiming the feature is live.

## Rollback boundary

There is no automated down migration in this repository. If a rollback is required after authorized production activation, use a reviewed follow-up migration to restore the previous function/check constraint and unschedule the named job. Do not delete historical alerts as a rollback shortcut.
