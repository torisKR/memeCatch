# Graph-engineering cycle-04

Callers: parent `/goal` + `/loop` tick 4 reads this file. No runtime import.
Cycle-01 DAG is fully judged (do not rewind). This file is the next-cycle change-list.

Date: 2026-08-30
Graph: servo DAG `plan → design → build → judge → deploy` (all judged; not rewound)
Doc: `docs/renewal/graph-engineering.md`
Runner: `scripts/graph-eng-run.mts`

## Nodes (cycle-01 DAG — not rewound)

| Node | Verdict | Why |
| --- | --- | --- |
| plan | pass | unchanged; `state.json` not rewritten |
| design | pass | unchanged |
| build | pass | unchanged |
| judge | pass | unchanged |
| deploy | pass | unchanged cycle-01/02 preview. This tick did **not** `vercel --prod`. |
| D-094 | skip | `docs/renewal/DECISIONS.md` is not clearly writable (GateGuard on prior ticks). Did not burn this tick on a retry. Fallback stays `artifacts/renewal/graph-eng/D-094.md`. |

## Change-list (this tick)

Local operator walk (local Supabase only)
- Reused existing `local.operator@example.test` (`profiles.role=operator`, uid `dbe37566-1535-4cf4-9a4f-3178a188d5c9`). Did not invent production credentials.
- Walked pending house-original `wait-ticket-meme` (`ff425e13-76b2-425b-9503-50fe6761cbae`, short_id `wqxcvqfy`) as that operator via PostgREST PATCH (same path as `transitionMemeStatus` for non-publish): **pending → fact_checking → rights_checking**.
- Stopped. Did **not** call `publish_house_original`. Did **not** PATCH approved/limited. `house_rights_attested_at` and `published_at` remain null. Public house-original count = 0.

Operator path a11y/copy (locked plan)
- Path current step now has `aria-current="step"`. Create form highlights pending as current.
- House-original fact button label 「사실 확인으로」 (catalog keeps 「사실 확인 시작」).
- Admin edit form origin field uses 「어떻게 만들었나요?」 for house originals; catalog keeps 「유래」.

D-094
- Skip. Did not attempt `docs/renewal/DECISIONS.md`.

Not in this slice
- `.gitignore`, `AGENTS.md`, `components/explore-grid.test.tsx`, `pnpm-workspace.yaml`, `.codex/`, `.omo/`
- Factory / weekly cron / server PNG / Plus-cron-R2 / `vercel --prod`

## Judge evidence

```
pnpm exec vitest run scripts/graph-eng-run.test.ts lib/house-original.test.ts \
  lib/safe-redirect.test.ts components/trust-note.test.tsx \
  components/admin/meme-status-controls.test.tsx \
  components/admin/admin-meme-contents.test.tsx \
  components/admin/house-original-form.test.tsx \
  components/admin/meme-edit-form.test.tsx
→ Test Files  8 passed (8) / Tests  59 passed (59)

pnpm exec tsc --noEmit → exit 0
pnpm exec eslint --max-warnings=0 <touched product+test files> → exit 0

git diff of operator-path *.test.*: assertions added (aria-current, 사실 확인으로, 어떻게 만들었나요?).
Catalog 「게시 승인」 / 「유래」 tests unchanged. No test files deleted.
```

## Locked rules honored

- No auto-publish (local row left at `rights_checking`; no production public house rows)
- No generation factory / weekly cron / server PNG
- No Plus / cron / R2 reopen
- No force-push, no invented credentials, no auto-merge
- House-original rules in `docs/renewal/original-meme-content-generation.md` unchanged
- DAG nodes left `judged` (no rewind)

## Next node for tick 4

Cycle-01 DAG remains halted. Tick 4 may locally attested-publish `wait-ticket-meme` **only in local Supabase** (still no production public house rows, still no `vercel --prod`). Otherwise keep operator-path copy/a11y. Retry D-094 into `docs/renewal/DECISIONS.md` only if that file is clearly writable; otherwise keep the artifact fallback. Do not rewind judged nodes. Do not reopen Plus/cron/R2.
