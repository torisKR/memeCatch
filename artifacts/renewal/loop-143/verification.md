# Loop 143 verification — PLUS-058

## Automated checks

| Check | Result |
| --- | --- |
| Focused Premium/Replay tests (`page`, Snapshot, History) | PASS — 3 files, 20 tests |
| Full `pnpm test` | PASS — 181 files, 1,300 tests |
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm lint` | PASS — 0 errors, 8 existing warnings |
| `pnpm build` (`next build --webpack`) | PASS — static generation 81/81 |
| `git diff --check` | PASS |

## Runtime observation

Latest production build was started locally with `next start -p 3102`.

- `/premium` → `307` to `/login?next=%2Fpremium`
- `/premium?replay=meme-1&replay_locale=ja&from=outcome_history` → `307` to a login return path that preserves
  only the allowlisted replay parameters
- `/en/explore` → `200`
- `/ja/explore` → `200`

The signed-out HTTP check proves the auth boundary and route handling only. Authenticated Plus/RLS, real receipt
rows, completion writes, external platform success, translation publication, and production deployment remain
human-gated and were not claimed.
