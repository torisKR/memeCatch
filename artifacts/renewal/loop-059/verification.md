# Loop 059 verification — localized submission flow

Date: 2026-08-08

## Acceptance evidence

- `SUBMIT_COPY` is the single locale/fallback source for page metadata, page/review/TikTok states, form fields, success state, upload/link-preview states, and error boundaries. `zh-tw` retains the project-wide Chinese fallback.
- `SubmitPage` and the server action call `getRequestLocale()` independently. The action does not accept a client form locale, so validation text is localized from trusted request context while the existing server validation boundary remains intact.
- The action still validates with Zod before authentication/RPC, rechecks supported oEmbed URLs server-side, requires `meme-uploads/${user.id}/` attachment paths, and preserves the existing rate-limit/RPC mappings. TikTok OAuth, `safeNext`, submission persistence, and upload limits were not changed.
- `SubmissionStatusBadge` accepts an optional local label only for the submit success state; the established status class is unchanged and all existing callers retain their original Korean label source.
- No migration, production database/content operation, deploy, push, or merge was performed.

## Commands

| Command | Result |
| --- | --- |
| `pnpm exec vitest run 'app/(default)/submit/actions.test.ts' lib/i18n-submit.test.ts components/content-url-preview.test.tsx components/submission-status.test.tsx` | PASS — 4 files / 28 tests |
| `pnpm test` | PASS — 96 files / 728 tests |
| `pnpm lint` | PASS — 0 errors; 7 pre-existing warnings |
| `npx tsc --noEmit` | PASS |
| `pnpm build` | PASS — Next.js 16.2.10 production build (known `metadataBase` warnings only) |
| `git diff --check` | PASS |

## Resume boundary

`GLO-004` is complete. `SUB-001` remains a production-migration/RLS/cron verification task, and `LOC-007` remains an offline machine-draft generation and human-review task. Neither was advanced in this loop.
