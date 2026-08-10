# Loop 058 verification — global onboarding recovery path

Date: 2026-08-08

## Acceptance evidence

- `TREND_ALERTS_INTERESTS_HREF` now targets the existing `/onboarding?next=/premium` path. An active Plus user can update interests and return to the dashboard rather than reaching the nonexistent `/my/interests` route.
- The onboarding form reads the active UI locale. Its step, title, explanation, nickname label/placeholder, display-category labels, age group/radiogroup labels, optional state, skip link, submit label, and pending label are in `MY_COPY` with the existing supported-locale fallback policy.
- The form still submits the same `interests`, `age_group`, and `next` values to `completeOnboarding`. Its category expansion behavior, optional age state, and `safeNext` boundary are unchanged.
- Dynamic onboarding metadata now uses the same request locale/copy as the form. No profile write, auth policy, schema, migration, analytics, locale route, deployment, or production content operation changed.

## Commands

| Command | Result |
| --- | --- |
| `pnpm exec vitest run 'app/(default)/onboarding/onboarding-form.test.tsx' components/premium/trend-alerts-bell.test.tsx lib/i18n-my.test.ts` | PASS — 3 files / 45 tests |
| `pnpm test` | PASS — 92 files / 700 tests |
| `pnpm lint` | PASS — 0 errors; 7 pre-existing warnings |
| `npx tsc --noEmit` | PASS |
| `pnpm build` | PASS — Next.js 16.2.10 production build |
| `git diff --check` | PASS |

## Resume boundary

The next global path is submission: `/submit` page, error, loading, form, and server-action validation still contain fixed Korean copy. That is a separate vertical because it crosses field validation and authenticated TikTok import states. `SUB-001` production migration and `LOC-007` translation generation retain their independent operational boundaries.
