# Loop 144 verification — GLO-009

## Automated checks

| Check | Result |
| --- | --- |
| Focused Passport/Premium tests | PASS — 4 files, 16 tests |
| Full `pnpm test` | PASS — 181 files, 1,304 tests |
| `pnpm exec tsc --noEmit --pretty false` | PASS |
| Changed-file ESLint | PASS — 0 errors |
| `pnpm lint` | PASS — 0 errors, 8 existing warnings |
| `pnpm build` (`next build --webpack`) | PASS — static generation 81/81; existing metadataBase warnings only. Sandbox DNS first blocked the read-only sitemap fetch; the same build succeeded with approved network access. |
| `git diff --check` | PASS |

## Runtime observation

Local production server: `next start -p 3100`.

- `/premium` → `307` to `/login?next=%2Fpremium`
- `/premium?replay=meme-1&replay_locale=ja&from=outcome_history` → `307` with the allowlisted replay return path
- `/en/explore` → `200`
- `/ja/explore` → `200`
- `/en/daily` → `200`
- `/ja/daily` → `200`

The signed-out checks prove route/auth boundaries only. Authenticated Plus/RLS, live Market Passport rows,
translation publication, actual completion/receipt writes, external platform success, live route supply, and
production deployment remain human-gated and were not claimed.
