# Loop 055 verification — localized Plus export upgrade

Date: 2026-08-08

## Acceptance evidence

- `components/export-button.tsx` centralizes its locked-export target in `exportUpgradeHref()`, which uses the established `localizedStaticPath("/pricing", locale)` boundary.
- This reuses the actual static-route allowlist from Loop 053: SEO locales retain their public localized pricing page, while UI-only locales remain on `/pricing` rather than receiving a 404 path.
- Every base export UI locale now has a localized close-control accessible name; `zh-tw` receives the existing Chinese fallback.
- `components/export-button.test.tsx` locks Korean, English, Japanese, and Traditional Chinese targets to real pricing URLs.

## Commands

| Command | Result |
| --- | --- |
| Vault helper/UI plus export-target regression tests | PASS — 5 files, 50 tests |
| `pnpm test` | PASS — 90 files, 695 tests |
| `pnpm lint` | PASS — 0 errors; 7 pre-existing warnings |
| `npx tsc --noEmit` | PASS |
| `pnpm build` | PASS — Next.js 16.2.10 production build |
| `git diff --check` | PASS |

## Production boundary

No billing request behavior, production database data, migration execution, deployment, push, merge, or checkout was performed. The localized public pricing targets become externally reachable after the normal reviewed deployment.
