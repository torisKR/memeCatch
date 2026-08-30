# Graph-engineering cycle-06

Callers: parent `/goal` + `/loop` tick 6 reads this file. No runtime import.
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

Guest origin heading: **cache / stale Next compile, not a source bug**
- Local row `wait-ticket-meme` (`ff425e13-76b2-425b-9503-50fe6761cbae`, short_id `wqxcvqfy`): `origin_kind=house_original`, `moderation_status=approved`, `house_rights_attested_at` set. Anon read of local PostgREST returned that row.
- Disk source `app/(default)/memes/[key]/page.tsx` already renders `<h3>{originSectionHeading(meme.origin_kind)}</h3>` (`eb5be1f`, 2026-08-30 23:31 KST). Helper returns 「어떻게 만들었나요?」 for `house_original`. Catalog stays 「어디서 시작됐어요?」. TrustNote already showed 「밈캐치 자체 제작」 from the same `meme.origin_kind`.
- Before refresh: `GET http://127.0.0.1:3000/memes/wqxcvqfy-wait-ticket-meme` HTML/RSC still had `<h3>어디서 시작됐어요?</h3>` next to 「밈캐치 자체 제작」. That pair is impossible from current source (`originSectionHeading` and `isHouseOriginal` cannot disagree). Dev server had been up since 2026-08-30T10:21:59Z with repeating `Watchpack Error (watcher): EMFILE: too many open files, watch`, so HMR never picked up the heading change.
- After restarting `next dev` on :3000: same URL → 「어떻게 만들었나요?」 ×2, 「어디서 시작됐어요?」 ×0, 「밈캐치 자체 제작」 still present. `Cache-Control: no-cache, must-revalidate` (dev, not CDN ISR).
- Did **not** change the guest origin `<h3>` copy. Locked the existing wiring with a source test so a hardcoded folk h3 cannot return.
- Remaining guest copy (not this slice): metadata + sr-only still say 「뜻과 유래」 (11 matches on the fresh HTML). Catalog folk heading is unchanged.

Operator-path / a11y polish (adjacent, after cache confirmation)
- Admin edit year field: house originals 「제작 연도」, catalog keeps 「유행 시작 연도」 (`originYearFieldLabel`).
- Create form origin hint is visible + `aria-describedby` (not placeholder-only). Year field reuses `originYearFieldLabel`.
- Rights-checking house originals: attestation checkbox `aria-required`; missing-evidence warning `id` + `aria-describedby`; 「수동 게시」 / limited disabled until rights evidence exists.

D-094
- Skip. Did not attempt `docs/renewal/DECISIONS.md`.

Production
- No production writes. No `vercel --prod`. No new public house_original rows created. (Read-only prod count was not re-fetched this tick: sandbox 403 on `supabase.co`. Prior tick attested 0 rows; this tick did not write prod.)

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
  supabase/house_original_contract.test.ts \
  "app/(default)/memes/[key]/page.renewal.test.ts" \
  "app/(default)/memes/[key]/page.test.ts"
→ Test Files  12 passed (12) / Tests  80 passed (80)

pnpm exec tsc --noEmit → exit 0

No test files deleted. Assertions added (originSectionHeading on guest h3, 제작 연도,
aria-required / disabled 수동 게시, origin hint describedby). Catalog 「유래」 /
「유행 시작 연도」 / 「게시 승인」 tests kept. page.test.ts origin locator updated to
the existing `{meme.origin || isHouseOriginal(...)}` condition (stale `{meme.origin && (`
would fail against current source; Plus-lock order unchanged).
```

## Locked rules honored

- No auto-publish (local `wait-ticket-meme` already approved from cycle-05; no new public house rows; no production writes)
- No generation factory / weekly cron / server PNG
- No Plus / cron / R2 reopen
- No force-push, no invented credentials, no auto-merge
- House-original rules in `docs/renewal/original-meme-content-generation.md` unchanged
- DAG nodes left `judged` (no rewind)

## Next node for tick 6

Cycle-01 DAG remains halted. Guest origin `<h3>` for local `wait-ticket-meme` is 「어떻게 만들었나요?」 after a Next restart (cache, not a copy bug). Tick 6 may switch house-original guest **metadata / sr-only** 「뜻과 유래」 to make-copy (catalog keeps 「뜻과 유래」 / 「어디서 시작됐어요?」), or keep operator-path polish. Still zero production public house_original rows. Still no `vercel --prod`. Retry D-094 into `docs/renewal/DECISIONS.md` only if that file is clearly writable; otherwise keep the artifact fallback. Do not rewind judged nodes. Do not reopen Plus/cron/R2.
