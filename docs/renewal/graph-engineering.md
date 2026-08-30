# CatchMeme graph-engineering workflow

Servo DAG for CatchMeme **development and design**. It stops when every node is judged. It is not an infinite regulator and not a weekly cron.

Runtime: `node scripts/graph-eng-run.mts` records node state one-way (`pending → running → judged`). 0 new npm deps. House-original rules in `docs/renewal/original-meme-content-generation.md` stay locked.

Callers of this file (documentation, not a runtime import):
- `scripts/graph-eng-run.mts` (`GRAPH_DOC` constant)
- `artifacts/renewal/graph-eng/cycle-01.md` (cycle change-list)

No existing file serves this purpose: `docs/renewal/LOOP_STATE.md` is the renewal loop log, not a servo DAG.

## ASCII diagram

```
                 ┌──────────────────────────────────────────┐
                 │  servo DAG  (stop when nodes judged)     │
                 └──────────────────────────────────────────┘

  [plan] ──▶ [design] ──▶ [build] ──▶ [judge] ──▶ [deploy]
    │           │            │           │            │
    │           │            │           │            └─ Vercel only if
    │           │            │           │               judge=pass AND
    │           │            │           │               production build OK
    │           │            │           └─ vitest (touched) + tsc --noEmit
    │           │            │              (+ lint on touched files)
    │           │            └─ smallest code that moves CatchMeme
    │           └─ UI / TrustNote / admin house-original
    └─ this file + cycle change-list + locked house-original rules

  skip-after-3-fails ──▶ record why ──▶ do not spin
  judged is terminal (no rewind to pending/running)
```

## Node owners

| Node | Owner | What it does | Must not do |
| --- | --- | --- | --- |
| `plan` | graph-eng lead (agent or operator) | Lock the DAG, cycle objective, and locked rules. Write/update this file and the cycle change-list stub. | Reopen Plus / cron / R2. Invent a generation factory. Redefine house-original as auto-publish. |
| `design` | design+product (same agent; user asked for independent judgment) | Guest/admin empty and attestation UX using existing tokens (`labels.ts`, `globals.css`). TrustNote house-original copy vs catalog empty CTA. Admin list/detail origin filter and badges. | New color tokens. Guest catalog empty CTA on house originals. Auto-publish memes. |
| `build` | implementation | Smallest code for the design node. Prefer existing files. 0 new npm deps. | Delete/weaken tests. Force-push. Invent credentials. Server PNG / weekly cron / generation factory. |
| `judge` | verifier (same agent; run commands, do not eyeball) | Focused vitest of touched files. `pnpm exec tsc --noEmit`. Lint on touched files. Confirm no test file deleted/weakened. | Treat “looks fine” as pass. Auto-merge without verification. |
| `deploy` | release | If judge is pass **and** `pnpm build` (repo: `next build --webpack`) succeeds, deploy via existing Vercel path. | Production deploy without tokens. Invent secrets. Auto-merge. Deploy after judge skip/fail. |

## Acceptance per node (machine-decidable)

### plan

- [ ] `docs/renewal/graph-engineering.md` exists (this file) **or** GateGuard fallback `artifacts/renewal/graph-eng/graph-engineering.md`.
- [ ] ASCII diagram, node owners, acceptance, and stop conditions are present.
- [ ] Cycle change-list path is named (`artifacts/renewal/graph-eng/cycle-NN.md`).

### design

- [ ] Guest house-original TrustNote does not use catalog “출처를 아시면 알려 주세요”.
- [ ] Guest house-original origin heading is not the folk “어디서 시작됐어요?” when `origin_kind=house_original`; empty origin still shows 「밈캐치 자체 제작」.
- [ ] Admin list empty for `?origin=house_original` offers `/admin/memes/new` (mirrors guest explore empty → `/submit`).
- [ ] Admin attestation copy uses existing safety tokens; missing rights evidence is visible before click-approve.
- [ ] Admin SNS empty copy for house originals does not tell the operator to wait for oEmbed ranking.

### build

- [ ] Touched product files implement the design checks above.
- [ ] D-094 is in `docs/renewal/DECISIONS.md` if that file is writable; otherwise skip is recorded.
- [ ] No new npm dependency. No generation factory / weekly cron / server PNG.

### judge

- [ ] Focused vitest of touched files exits 0.
- [ ] `pnpm exec tsc --noEmit` exits 0.
- [ ] No test file deleted; assertions not weakened (spot-check git diff of `*.test.*`).
- [ ] Change-list written for the cycle.

### deploy

- [ ] `pnpm build` (or `next build --webpack`) exits 0.
- [ ] Existing Vercel path used (`vercel` CLI or git-push to the linked project).
- [ ] If tokens/auth are missing: record the blocker in the change-list. Do not invent secrets.
- [ ] Preview unless the operator explicitly asked for production.

## Stop conditions

The graph **stops** when all nodes are `judged` (pass or skip). Do not re-enter a judged node.

| Signal | Action |
| --- | --- |
| Node `judge` verdict `pass` | Start `deploy` only after `pnpm build` also passes. |
| Node `judge` verdict `fail` | Stay `running`, increment attempts. After **3** failed attempts, `skip` and record why. |
| Node `deploy` missing Vercel token / unauthenticated CLI | `skip` with blocker text. Do not invent credentials. |
| `docs/` GateGuard | Write the same content under `artifacts/renewal/graph-eng/` and skip the docs write. Do not spin. |
| Locked house-original rule conflict | Skip the offending build slice. Do not auto-publish, do not add a factory. |
| All nodes judged | Servo halt. Next parent tick may open a **new** cycle file (`cycle-02.md`), not rewind this DAG. |

## Runner

```bash
node scripts/graph-eng-run.mts status
node scripts/graph-eng-run.mts start <plan|design|build|judge|deploy>
node scripts/graph-eng-run.mts judge <node> pass
node scripts/graph-eng-run.mts judge <node> fail --reason "…"
node scripts/graph-eng-run.mts judge <node> skip --reason "…"
```

State file: `artifacts/renewal/graph-eng/state.json` (one-way; `judged` is terminal).

Field names: `nodes.<id>.status` (`pending` \| `running` \| `judged`), `nodes.<id>.verdict` (`null` \| `pass` \| `fail` \| `skip`), `nodes.<id>.attempts` (integer), `nodes.<id>.reason` (string), `updatedAt` (ISO-8601). Synthetic example: `{"updatedAt":"2026-08-30T00:00:00.000Z","nodes":{"plan":{"status":"pending","verdict":null,"attempts":0,"reason":""}}}`.

## Out of scope (locked)

- Auto-publish memes
- Generation factory / weekly cron / server PNG
- Reopening Plus / cron / R2
- Force-push, invented credentials, auto-merge without verification
- Weakening or deleting tests
