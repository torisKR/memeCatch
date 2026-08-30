# Graph-engineering cycle-01

Callers: parent `/goal` + `/loop` tick 2 reads this file. No runtime import.
No existing cycle-01 file (Glob `artifacts/renewal/graph-eng/cycle-01.md` was empty).
State schema lives in `artifacts/renewal/graph-eng/state.json` (ISO-8601 `updatedAt`).
User instruction: "Write a change-list in `artifacts/renewal/graph-eng/cycle-01.md`."

Date: 2026-08-30
Graph: servo DAG `plan → design → build → judge → deploy`
Doc: `docs/renewal/graph-engineering.md`
Runner: `scripts/graph-eng-run.mts`

## Nodes

| Node | Verdict | Why |
| --- | --- | --- |
| plan | pass | DAG doc landed in `docs/renewal/graph-engineering.md`. ASCII diagram, owners, acceptance, stop conditions present. |
| design | pass | Guest house-original empty origin uses 「어떻게 만들었나요?」 + 「밈캐치 자체 제작」; TrustNote catalog CTA unchanged. Admin empty `?origin=house_original` CTAs to `/admin/memes/new`. Attestation shows yellow evidence warning. Admin SNS empty for house originals does not mention oEmbed ranking. |
| build | pass | Smallest product edits + one-way runner. 0 new npm deps. No factory / weekly cron / server PNG / Plus-cron-R2 reopen. |
| D-094 | skip | `docs/renewal/DECISIONS.md` GateGuard + hook JSON block after 2 retries. Canonical paste remains in `artifacts/renewal/loop-148/house-original-t6.md`. |
| judge | pass | Focused vitest 7 files / 51 tests. `pnpm exec tsc --noEmit` exit 0. ESLint on touched product files exit 0. No `*.test.*` deleted; diffs are additions only. `pnpm build` succeeded (89/89 pages). |
| deploy | running | Local build green. Vercel linked (`prj_fWt03H8a0rZtoDuCxczV7NhM4OEd`). CLI user `ironjustlikethat-4318`. Preview deploy requested after judge+build pass. |

## Change-list

Added
- `docs/renewal/graph-engineering.md` — servo DAG
- `scripts/graph-eng-run.mts` — one-way pending → running → judged
- `scripts/graph-eng-run.test.ts` — rewind forbidden; skip after 3 fails; deploy blocked unless judge pass

Product / design
- `lib/house-original.ts` — origin filter, empty copy, origin heading helpers
- `lib/safe-redirect.ts` — allowlist `origin=house_original` on admin login return
- `components/admin/badges.tsx` — `OriginKindBadge`
- `app/(default)/admin/memes/page.tsx` — `?origin=house_original`, empty CTA, badge
- `app/(default)/admin/memes/[id]/page.tsx` — badge, rights evidence, house-original SNS empty
- `components/admin/meme-status-controls.tsx` — yellow missing-evidence warning (existing safety tokens)
- `components/admin/admin-meme-contents.tsx` — house-original empty copy
- `app/(default)/memes/[key]/page.tsx` — house-original origin heading even when origin copy is empty

Tests added (not weakened)
- `lib/house-original.test.ts`
- `lib/safe-redirect.test.ts`
- `components/admin/meme-status-controls.test.tsx`
- `components/admin/admin-meme-contents.test.tsx`

Not in this slice
- `.gitignore`, `AGENTS.md`, `components/explore-grid.test.tsx`, `pnpm-workspace.yaml`, `.codex/`, `.omo/`

## Judge evidence

```
pnpm exec vitest run scripts/graph-eng-run.test.ts lib/house-original.test.ts \
  lib/safe-redirect.test.ts components/trust-note.test.tsx \
  components/admin/meme-status-controls.test.tsx \
  components/admin/admin-meme-contents.test.tsx \
  components/admin/house-original-form.test.tsx
→ Test Files  7 passed (7) / Tests  51 passed (51)

pnpm exec tsc --noEmit → exit 0

pnpm exec eslint --max-warnings=0 <touched product files> → exit 0

pnpm build (next build --webpack, network) → Compiled successfully, 89/89 static pages
```

## Locked rules honored

- No auto-publish
- No generation factory / weekly cron / server PNG
- No Plus / cron / R2 reopen
- No force-push, no invented credentials, no auto-merge
- House-original rules in `docs/renewal/original-meme-content-generation.md` unchanged

## Next node for tick 2

If deploy preview is live: operator paste of D-094 into `docs/renewal/DECISIONS.md` (GateGuard-blocked this cycle), then one real pending house-original row through fact → rights → attested publish (still manual, no auto-publish). Do not reopen Plus/cron/R2.
