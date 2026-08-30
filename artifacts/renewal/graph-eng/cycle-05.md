# Graph-engineering cycle-05

Callers: parent `/goal` + `/loop` tick 5 reads this file. No runtime import.
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
| D-094 | skip | `docs/renewal/DECISIONS.md` is not clearly writable (GateGuard on prior ticks). Did not burn this tick on a retry. Fallback stays `artifacts/renewal/graph-eng/D-094.md`. |

## Change-list (this tick)

Local attested publish (local Supabase only)
- Reused existing `local.operator@example.test` (`profiles.role=operator`, uid `dbe37566-1535-4cf4-9a4f-3178a188d5c9`). Did not invent production credentials. Login used the local `supabase-demo` anon JWT against `http://127.0.0.1:54321` only.
- Inspected `wait-ticket-meme` (`ff425e13-76b2-425b-9503-50fe6761cbae`, short_id `wqxcvqfy`): `origin_kind=house_original`, `moderation_status=rights_checking`, `house_rights_attested_at` null.
- `meme_sources` already had a locked-contract evidence row (`9dab5e72-3225-474e-b137-8eee55f75043`): `source_role=original`, `rights_basis=creator_permission`, canonical CatchMeme URL `http://localhost:3000/memes/wqxcvqfy-wait-ticket-meme`, `platform=catchmeme`, `creator_name=CatchMeme`. Did **not** insert a duplicate. `house_original_has_rights_evidence` returned `true`.
- Called `POST /rest/v1/rpc/publish_house_original` as that operator (`p_meme_id`, `p_to=approved`, `p_attested=true`). HTTP 200 / `true`. Did **not** PATCH `approved`/`limited`.
- After: `moderation_status=approved`, `house_rights_attested_at=2026-08-30T15:18:30.916025+00:00`, `published_at` same instant, `origin_kind=house_original`. Anon RLS can read the local row.

Public TrustNote
- Local `GET http://127.0.0.1:3000/memes/wqxcvqfy-wait-ticket-meme` → 200, title `대기표 밈 뜻 | 밈캐치`.
- HTML contains 「밈캐치 자체 제작」. Catalog empty CTA 「근거 출처 준비 중」 / 「출처를 아시면 알려 주세요」 / 검수팀 확인: absent.

Production
- Read-only anon GET `onjipuldngbdptldkpoe.supabase.co` `memes?origin_kind=eq.house_original&moderation_status=in.(approved,limited)` → HTTP 200, **0 rows**. No production writes. No `vercel --prod`.

Guest origin heading (not fixed this tick)
- The same local public HTML still renders origin `<h3>어디서 시작됐어요?</h3>` next to 「밈캐치 자체 제작」. Source already calls `originSectionHeading(meme.origin_kind)` (expected 「어떻게 만들었나요?」). Treat as stale local Next or a guest-copy follow-up, not a DAG rewind.

D-094
- Skip. Did not attempt `docs/renewal/DECISIONS.md`.

Not in this slice
- `.gitignore`, `AGENTS.md`, `components/explore-grid.test.tsx`, `pnpm-workspace.yaml`, `.codex/`, `.omo/`
- Factory / weekly cron / server PNG / Plus-cron-R2 / `vercel --prod`

## Judge evidence

```
pnpm exec vitest run scripts/graph-eng-run.test.ts lib/house-original.test.ts \
  lib/safe-redirect.test.ts lib/actions/admin-house-original.test.ts \
  components/trust-note.test.tsx \
  components/admin/meme-status-controls.test.tsx \
  components/admin/admin-meme-contents.test.tsx \
  components/admin/house-original-form.test.tsx \
  components/admin/meme-edit-form.test.tsx \
  supabase/house_original_contract.test.ts
→ Test Files  10 passed (10) / Tests  71 passed (71)

pnpm exec tsc --noEmit → exit 0

No product files edited this tick. No test files deleted or weakened.
```

## Locked rules honored

- No auto-publish (operator RPC + `p_attested=true` + existing rights evidence; no production public house rows)
- No PATCH to approved/limited (RPC only)
- No generation factory / weekly cron / server PNG
- No Plus / cron / R2 reopen
- No force-push, no invented credentials, no auto-merge
- House-original rules in `docs/renewal/original-meme-content-generation.md` unchanged
- DAG nodes left `judged` (no rewind)

## Next node for tick 5

Cycle-01 DAG remains halted. Local attested publish of `wait-ticket-meme` is done. Tick 5 should fix guest public origin copy for house originals: live local detail still shows 「어디서 시작됐어요?」 beside 「밈캐치 자체 제작」 (and metadata/sr-only 「뜻과 유래」). Confirm after a Next refresh whether that is stale cache; if source is at fault, switch the origin `<h3>` / metadata to `originSectionHeading` / 「어떻게 만들었나요?」. Still zero production public house_original rows. Still no `vercel --prod`. Retry D-094 into `docs/renewal/DECISIONS.md` only if that file is clearly writable; otherwise keep the artifact fallback. Do not rewind judged nodes. Do not reopen Plus/cron/R2.
