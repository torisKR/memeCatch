# Loop 079 verification — PLUS-015

Date: 2026-08-09 (Asia/Seoul)
Branch: `main`
Scope: forward migration source contract and local repository gates

## Result

PASS for the local Plus alert entitlement RLS contract. The historical
migrations were not rewritten; a new idempotent migration requires owner
identity and active Plus for both private alert tables.

## Evidence

- `pnpm exec vitest run supabase/plus_alert_entitlement_rls.test.ts supabase/plus_saved_context_watch.test.ts supabase/plus_saved_meme_rising_alerts.test.ts --reporter=dot`
  - 3 files / 14 tests passed.
- `pnpm test`
  - 143 files / 942 tests passed.
- `pnpm exec tsc --noEmit`
  - exit 0.
- `pnpm lint`
  - exit 0; existing 7 warnings, no errors.
- `pnpm build`
  - exit 0; Next.js 16.2.10 webpack, 73/73 static pages.
- `git diff --check`
  - exit 0.

## Changed contract

- `trend_alerts_self_read` now requires
  `user_id = (select auth.uid())` and
  `public.has_active_plus((select auth.uid()))`.
- `plus_saved_context_alerts_self_read` now requires the same two predicates.
- No browser table-write grants, new RPC, fan-out change, production
  migration, deployment, or database write was performed.

## Gaps

- Active/expired JWT PostgREST requests were not observed because no live
  authenticated test sessions or local Supabase Docker database were
  available.
- Whether the forward migration is applied in production remains an explicit
  operational gate.
