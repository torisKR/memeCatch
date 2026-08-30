# Graph-engineering cycle-08

Callers: parent `/goal` + `/loop` tick 8 reads this file. No runtime import.
Cycle-01 DAG is fully judged (do not rewind). This file is the next-cycle change-list.

Date: 2026-08-31
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
| D-094 | skip | `docs/renewal/DECISIONS.md` is not clearly writable (GateGuard on prior ticks). Did not retry. Fallback stays `artifacts/renewal/graph-eng/D-094.md`. |

## Change-list (this tick)

Local guest copy (local Supabase only)
- Inspected published house-original `wait-ticket-meme` (`ff425e13-76b2-425b-9503-50fe6761cbae`, short_id `wqxcvqfy`): origin was operator process notes (“pending으로 저장했다. 사실 확인·권리 확인·게시는 하지 않았다”).
- As `local.operator@example.test` (uid `dbe37566-1535-4cf4-9a4f-3178a188d5c9`) against `http://127.0.0.1:54321` only: PATCH `description` / `origin` / `usage_note` to honest make-copy (how CatchMeme made the wait-ticket format). Did **not** invent folk origin or production rows.
- Copy UPDATE reverted the row to `rights_checking` (existing `guard_house_original_memes` trigger). Re-called `publish_house_original` (`p_to=approved`, `p_attested=true`) on the **same** local row. Not a new meme; not production.
- After: `moderation_status=approved`, `origin_kind=house_original`, attestation set, origin contains 「자체 그래픽」, no 「게시는 하지 않았다」.

Live local HTML (`GET http://127.0.0.1:3000/memes/wqxcvqfy-wait-ticket-meme` → 200)
- 「게시는 하지 않았다」 / 「pending으로 저장」 / 「사실 확인·권리 확인」 ×0
- 「어떻게 만들었나요?」 ×2, 「무슨 뜻이에요?」 ×2, 「밈캐치 자체 제작」 present
- 「어디서 시작됐어요?」 ×0
- New origin/meaning/usage prose present (「자체 그래픽」, 「대기표를 뽑았다」, 「친구 사이 농담」)

Operator-path lock (code, not DB)
- `houseOriginalOriginLooksLikeOperatorScratch` / hint / error in `lib/house-original.ts`.
- `createHouseOriginal` and `updateMeme` reject that scratch on house originals before write.
- Create + edit origin fields `aria-describedby="house-origin-hint"` (catalog edit keeps 「유래」, no hint).

D-094
- Skip. Did not attempt `docs/renewal/DECISIONS.md`.

Production
- No production writes. No `vercel --prod`. No new public house_original rows created.

Not in this slice
- `.gitignore`, `AGENTS.md`, `components/explore-grid.test.tsx`, `pnpm-workspace.yaml`, `.codex/`, `.omo/`
- Factory / weekly cron / server PNG / Plus-cron-R2 / `vercel --prod`
- Local DB row itself (not a migration; do not commit as schema)

## Judge evidence

```
NEXT_PUBLIC_SITE_URL=https://catchmeme.com pnpm exec vitest run \
  lib/house-original.test.ts lib/actions/admin-house-original.test.ts \
  lib/actions/admin.test.ts \
  components/admin/house-original-form.test.tsx \
  components/admin/meme-edit-form.test.tsx \
  "app/(default)/memes/[key]/page.renewal.test.ts" \
  "app/(default)/memes/[key]/page.test.ts" \
  components/trust-note.test.tsx
→ Test Files  8 passed (8) / Tests  57 passed (57)

pnpm exec tsc --noEmit → exit 0

No test files deleted. Assertions added (scratch origin rejected; origin hint
describedby on create+house edit). Catalog 「유래」 test kept.
```

## Locked rules honored

- No auto-publish of a **new** meme (same local `wait-ticket-meme` re-attested after copy trigger revert; no production public house rows)
- No generation factory / weekly cron / server PNG
- No Plus / cron / R2 reopen
- No force-push, no invented production credentials, no auto-merge
- House-original rules in `docs/renewal/original-meme-content-generation.md` unchanged
- DAG nodes left `judged` (no rewind)
- Cursor goals not marked complete

## Next node for tick 8

Cycle-01 DAG remains halted. Local `wait-ticket-meme` origin/meaning is guest-honest make-copy; operator scratch is rejected on create/update. Tick 8 may pick a small adjacent operator-path/a11y polish (catalog edit origin stays 「유래」; site-wide footer/org JSON-LD still say 「뜻과 유래」 as product voice, not this document), or leave copy. Still zero production public house_original rows. Still no `vercel --prod`. Retry D-094 into `docs/renewal/DECISIONS.md` only if that file is clearly writable; otherwise keep the artifact fallback. Do not rewind judged nodes. Do not reopen Plus/cron/R2.
