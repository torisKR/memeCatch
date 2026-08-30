# Graph-engineering cycle-02

Callers: parent `/goal` + `/loop` tick 2 reads this file. No runtime import.
Cycle-01 DAG is fully judged (do not rewind). This file is the next-cycle change-list.

Date: 2026-08-30
Graph: servo DAG `plan → design → build → judge → deploy` (all judged after this tick’s deploy)
Doc: `docs/renewal/graph-engineering.md`
Runner: `scripts/graph-eng-run.mts`
Preview: https://memecatch-5rqf2ac25-ironjustlikethatgmailcoms-projects.vercel.app
Inspect: https://vercel.com/ironjustlikethatgmailcoms-projects/memecatch/Cb5h1YxZg5rx5WzrrZAaDCEsY1cB

## Nodes (cycle-01 DAG — not rewound)

| Node | Verdict | Why |
| --- | --- | --- |
| plan | pass | unchanged from cycle-01 |
| design | pass | unchanged from cycle-01 |
| build | pass | unchanged from cycle-01 |
| judge | pass | unchanged from cycle-01 |
| deploy | pass | Preview READY `dpl_Cb5h1YxZg5rx5WzrrZAaDCEsY1cB`. No cycle-01 preview existed (oldest previews were 13d+; 36m production was `4de1c8d` on main). `vercel --yes` (not `--prod`). SSO protection 302 on anonymous curl is expected. |
| D-094 | skip | GateGuard facts + one retry on `docs/renewal/DECISIONS.md`. Fallback: `artifacts/renewal/graph-eng/D-094.md` and `artifacts/renewal/loop-148/house-original-t6.md`. |

## Change-list (this tick)

Deploy
- Finished running → judged pass. Preview only. Did not invent tokens. Did not promote to production.

Operator path (post-DAG; does not rewind judged nodes)
- `lib/house-original.ts` — `houseOriginalOperatorPath` / `houseOriginalPathNote` / `houseOriginalTransitionLabel`. Publish stays upcoming until approved/limited. Rejected blocks attested publish. No auto-publish.
- `components/admin/meme-status-controls.tsx` — 4-step path, rights source URL, house-original approve label 「수동 게시」.
- `components/admin/house-original-form.tsx` — same path on create; still pending-only save.
- `app/(default)/admin/memes/[id]/page.tsx` — pass `rightsSourceUrl` from `meme_sources`.

Tests added (not weakened)
- `lib/house-original.test.ts` — path states + no auto-complete from pending
- `components/admin/meme-status-controls.test.tsx` — path + 「수동 게시」 + source URL
- `components/admin/house-original-form.test.tsx` — path visible; no one-click publish

## Judge evidence

```
pnpm exec vitest run scripts/graph-eng-run.test.ts lib/house-original.test.ts \
  lib/safe-redirect.test.ts components/trust-note.test.tsx \
  components/admin/meme-status-controls.test.tsx \
  components/admin/admin-meme-contents.test.tsx \
  components/admin/house-original-form.test.tsx
→ Test Files  7 passed (7) / Tests  54 passed (54)

pnpm exec tsc --noEmit → exit 0
pnpm exec eslint --max-warnings=0 <touched product files> → exit 0
```

## Locked rules honored

- No auto-publish (no production row walk; UI path only)
- No generation factory / weekly cron / server PNG
- No Plus / cron / R2 reopen
- No force-push, no invented credentials, no auto-merge
- House-original rules in `docs/renewal/original-meme-content-generation.md` unchanged

## Next node for tick 2

Cycle-01 DAG is halted (all judged). Tick 2 should preview-deploy this operator-path slice (`vercel --yes`, not production) so admin `/admin/memes/new` and detail show pending → fact → rights → 수동 게시. Operator may then walk one real pending house-original row (still manual). Retry D-094 into `docs/renewal/DECISIONS.md` only if GateGuard is unlocked; otherwise keep the artifact fallback. Do not rewind judged nodes. Do not reopen Plus/cron/R2.
