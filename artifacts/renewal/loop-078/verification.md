# Loop 078 verification — PLUS-014

Date: 2026-08-09 (Asia/Seoul)
Branch: `main`
Scope: local code, source-contract tests, local production build/HTTP only

## Result

PASS for the local PLUS-014 contract. The fulfillment center is active-Plus
server-owned, owner-scoped, exact-locale, and read-only. This is not a public
release or production DB completion claim.

## Targeted evidence

- `pnpm exec vitest run lib/plus-translation-fulfillment.test.ts lib/plus-translation-fulfillment.server.test.ts components/premium/plus-translation-fulfillment-center.test.tsx components/premium/premium-dashboard-content.test.tsx lib/i18n-premium.test.ts --reporter=dot`
  - 5 files / 102 tests passed.
- `pnpm exec vitest run supabase/plus_translation_priority_requests.test.ts --reporter=dot`
  - 1 file / 8 tests passed.
- The RLS source contract now requires both `user_id = (select auth.uid())`
  and `public.has_active_plus((select auth.uid()))` for self reads. Operator
  read/update and the request/completion functions remain covered.

## Full code gates

- `pnpm test` — 142 files / 937 tests passed.
- `pnpm exec tsc --noEmit` — exit 0.
- `pnpm lint` — exit 0; existing 7 warnings, no new errors.
- `pnpm build` — exit 0; Next.js 16.2.10 webpack, 73/73 static pages.
- `git diff --check` — exit 0.

## Observed local production HTTP

The built app was started with `next start` on `127.0.0.1:3110`.

- `GET /premium` — 307 to `/login?next=%2Fpremium`.
- `GET /premium?locale=en` — 307 to `/login?locale=en&next=%2Fpremium`.
- `POST /api/translation-priority` without a session — 401 JSON with
  `cache-control: no-store`; CSP, HSTS, nosniff, frame, referrer, and
  permissions headers remained present.

## Boundaries and gaps

- No production migration, Supabase write, RPC execution, deployment, push, or
  merge was performed.
- No authenticated Plus or operator session was available. The full
  request → operator claim → human reviewed/current translation → completion
  alert → exact-locale reopen flow remains an operational QA gate.
- Real Supabase RLS behavior for expired Plus direct reads and the existing
  completion trigger was not observed; only the migration source contract and
  mocked loader tests were run.
- Existing global translation coverage remains partial: the offline artifact is
  448/1,520 rows. No translation rows were created or changed.
