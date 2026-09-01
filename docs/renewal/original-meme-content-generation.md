# CatchMeme house-original meme content (자체 밈 콘텐츠)

Status: locked (2026-08-29) — operator accepted all 12 recommended defaults (D3=A)
Audience: 1-person operator implementing the next vertical slice
Grounding: `LOOP.md` rules 4–6, `docs/architecture.md` source pipeline, `docs/renewal/{DECISIONS,BACKLOG,LOOP_STATE}.md`, `artifacts/renewal/loop-148/plan.md`, existing Studio / Creator Pack / admin moderation

**Product one-liner:** CatchMeme can publish memes it actually created and owns, labeled as house originals, through the existing fact → rights → approved/limited gate. It will not auto-publish AI drafts, scrape-and-claim originality, or mint a second generation stack.

**Recommended default (this review):** ship the **minimal version** below. Do not build a generation factory. Scope reduction is explicit, not silent.

### 2026-08-31 Bedrock generation override

This section supersedes the older “do not add Bedrock” notes below for the house-original draft path only.

- The admin house-original form may call Amazon Bedrock Nova 2 Lite through the global inference profile `global.amazon.nova-2-lite-v1:0` and returns exactly three Korean drafts. Review is intentionally minimal: the operator can save a selected draft directly, but the row is still created as `pending`.
- The public Studio remains template-only and must not call Bedrock or consume the Bedrock budget.
- The application enforces a non-resetting lifetime hard cap of **$100** before invocation. AWS Budgets is a delayed secondary alert, not the hard stop.
- Static AWS access keys are forbidden. Vercel uses OIDC to assume a least-privilege role in `ap-northeast-2`.
- Draft generation never publishes automatically and never stores third-party original media.
- MPE is unchanged and isolated from this exception: `stealth/ox-alpha` only, **$0**, paid fallback prohibited, ECS `DesiredCount=0` until separately activated.

---

## Problem

CatchMeme is a Korean meme dictionary. Users search a meme and need meaning, origin, whether it is usable now, caution, and evidence. Today almost every public row is a **catalog** document of an existing internet meme. “자체적인 밈 콘텐츠 생성” is easy to misread as “let a model invent dictionary pages.” That reading fights the product:

- `LOOP.md` rule 4: AI-written meaning, origin, sources, examples, and safety never auto-publish. Drafts only.
- `LOOP.md` rule 6: do not weaken copyright/embed policy; do not store third-party original files.
- Architecture: official API/oEmbed candidate → `/admin/sources` → link or official embed. Ranking scores are triage, never publication approval (`data/memes/review/README.md`).
- 1-person ops: a new model pipeline, cron poster, or MPE fork is unpaid glue work.

The honest product move is a **second provenance class**: CatchMeme-authored memes, with CatchMeme as rights holder, still going through human fact and rights checks. Catalog work (DQ-002 thin docs, source ranking, unsourced admin queue) stays catalog work.

---

## What “house original” means

| Kind | Who made the meme | CatchMeme’s job | Public copy |
| --- | --- | --- | --- |
| `catalog` (today’s default) | Someone on the internet | Document meaning, origin, safety, evidence | Never claim CatchMeme created it |
| `house_original` (this plan) | CatchMeme | Create the joke/format, own the copy and graphics, then document it | Say “밈캐치 자체 제작” |

House originals are not “AI filled in a thin catalog row.” They are not user Studio PNGs. They are not Plus Creator Pack exports of other people’s memes.

Chicken-and-egg: a dictionary entry is not a folk meme until people use it. House originals must not pretend to be folk culture. Label them as CatchMeme-authored. Spreading on owned social is an ops habit, not a product auto-poster.

---

## Step 0 — Scope challenge

### 1. What already exists (reuse, do not rebuild)

| Sub-problem | Existing code | Reuse? |
| --- | --- | --- |
| Caption / idea generation | `/studio`, `lib/meme-studio.server.ts`, `POST /api/meme-studio` (rate-limited, no DB write, template fallback) | Yes for optional **draft copy**. Never INSERT into `memes`. |
| Client PNG of CatchMeme graphics | `components/studio/artifact-studio.tsx` dictionary mode: “외부 SNS 이미지는 복사하지 않고 밈캐치 자체 그래픽과 입력한 텍스트만 사용합니다.” Files stay in the browser. | Yes as the **visual recipe**. Dictionary publication still needs a server row + rights attestation. |
| Plus share cards from reviewed facts | `lib/plus-creator-pack.ts`, Action Inbox, no-auto-posting (loop 147 PLUS-060) | **Do not reuse as a factory.** Packs catalog facts for subscribers. |
| Human publication gate | `check_moderation_transition()` in `supabase/migrations/20260727000000_unpublish_to_fact_checking.sql`: pending → fact_checking → rights_checking → approved/limited | **Required.** Same trigger. No parallel state machine. |
| Operator status buttons | `transitionMemeStatus` in `lib/actions/admin.ts`, `MemeStatusControls` | Extend for house-original rights attestation. Do not add a second transition API. |
| Operator AI draft | `generateDraft` in `lib/actions/admin.ts` — structured JSON, audit log, “자동 게시나 자동 저장을 하지 않으며” | Clone the **contract** (draft only). Do not point it at house originals without a new prompt that forbids inventing folk origin. |
| Third-party media ingest | MPE: `media_ingestions` 20MB, 24h delete, `rights_basis` / `source_role`, publish projection | **Wrong tool** for assets CatchMeme wants to keep. Do not fork. |
| Quality / index gates | `lib/content-depth.ts` (D-001), sitemap/robots/ads | Same functions. House originals are not exempt from thin-document rules. |
| Source ranking / unsourced queue | loop 148 ADMIN-Q-001, `lib/admin-quality-queue.ts`, review JSONL | Catalog ops. Out of this slice. |
| Admin create-from-submission | `approveSubmission` walks fact_checking → rights_checking → approved **in one request** | **Do not copy** for house originals. That walk is the rights-gate hole this plan closes. |

### 2. Minimum change that hits the goal

1. Provenance: `origin_kind` on `memes` (`catalog` default, `house_original`).
2. Create: operator form that INSERTs `pending` + `house_original` only. No status walk.
3. Rights: `rights_checking` → `approved`/`limited` for house originals requires attested `creator_permission` + `source_role=original` + operator checkbox. Enforce in DB, not only UI.
4. Trust: public TrustNote / origin copy says 자체 제작, never “검수팀이 인터넷 원본을 확인”.
5. Tests: cannot skip gate, studio POST does not write `memes`, AI draft does not INSERT, thin house originals still fail `isIndexableMeme`.

Everything else is deferrable: weekly cadence cron, R2 house-template CDN, Plus pack inclusion, social posting, image-generation models, MPE keep-forever storage, bulk backfill of existing rows.

### 3. Complexity smell

A “complete generation platform” (new draft table, worker, OpenRouter budget fork, R2 renderer, cron poster, Plus pack, MPE ingest mode, public UGC upload) is **well over 8 files and 2+ services**. Smell triggered.

**Minimal version (recommended, this plan’s implementation target):** 7 modules, 0 new services, 0 new crons.

| # | Module |
| --- | --- |
| 1 | `supabase/migrations/*_house_original_provenance.sql` |
| 2 | `lib/house-original.ts` + `lib/house-original.test.ts` |
| 3 | `lib/actions/admin.ts` (create + gated transition) + tests |
| 4 | `components/admin/house-original-form.tsx` (or extend meme create) + test |
| 5 | `components/admin/meme-status-controls.tsx` (attestation on house original) |
| 6 | `components/trust-note.tsx` + `lib/labels.ts` + tests |
| 7 | `lib/database.types.ts` regen after migration (local) |

Full platform stays in NOT in scope. Do not silently drop it; do not build it in this slice.

### 4. Search check (2026)

- Human-in-the-loop + **rights gating on by default** is current practice for anything that looks like generated or first-party branded content. Un-cleared assets must not reach the storefront.
- AI drafts are allowed; auto-approval is for low-risk archive, not publication.
- Next.js App Router already has Server Actions (`"use server"`) and Route Handlers. No new job framework. **[Layer 1]**
- Postgres CHECK + trigger already own moderation. Adding `origin_kind` + a rights-attestation guard is the boring path. **[Layer 1]**
- A custom “generation microservice” would spend the shop’s innovation token on the wrong problem. **[Layer 3 / EUREKA]:** CatchMeme’s trust comes from *not* pretending generated text is folk evidence. The novel move is provenance, not another model call.

Search unavailable for framework footguns beyond in-repo evidence: Studio already rate-limits; MPE already refuses unknown/blocked `rights_basis`. Proceeding with repo + 2026 governance sources.

### 5. TODOS.md

No `TODOS.md` in repo. Deferred catalog work lives in `docs/renewal/BACKLOG.md` (DQ-002, DQ-007, HG-002/003 data). This plan does not bundle those. It must not be used as a shortcut to “AI-complete thin catalog docs.”

### 6. Completeness vs shortcut

Shortcut that looks cheap: tag a few rows “original” in admin copy and call it done. That fails the first time a house row has no rights row and TrustNote still says 근거 준비 중 / 검수팀 확인.

Complete-for-this-slice: DB invariant + transition guard + public copy + tests. That is minutes with CC, not a quarter. Recommend complete **minimal** slice, not complete **platform**.

### 7. Distribution

No new artifact type (no CLI, container, mobile app). Existing Vercel deploy. Migration is local/staging until a human applies it. This review does not apply production SQL.

---

## Goal and non-goals

**Goal:** An operator can create a CatchMeme-owned meme, move it through fact and rights as separate human steps, and show readers that CatchMeme made it.

**Non-goals (also listed again under NOT in scope):** auto-publish, production SQL in this work, new SNS poster, MPE fork, Plus Creator Pack rewrite, AI filling DQ-002 catalog holes, user UGC becoming dictionary rows.

---

## Architecture (minimal)

### Provenance and gates

House originals use the same moderation enum. Extra rules only when `origin_kind = 'house_original'`.

```
                    ┌─────────────────────────────────────┐
                    │  Operator: "자체 제작" form          │
                    │  title, summary, description,        │
                    │  origin = how CatchMeme made it,     │
                    │  optional AI draft (clipboard/JSON)  │
                    └─────────────────┬───────────────────┘
                                      │ INSERT only
                                      │ origin_kind=house_original
                                      │ moderation_status=pending
                                      v
                               pending
                                      │ human: is this actually ours?
                                      │ not a copy of catalog/internet meme?
                                      v
                             fact_checking
                                      │ human: copy + graphics we own?
                                      │ no third-party likeness/audio/logo
                                      v
                            rights_checking
                                      │ DB refuses approved/limited unless:
                                      │  - rights_basis = creator_permission
                                      │  - source_role = original
                                      │  - house_rights_attested_at set
                                      │  - operator uid in audit log
                                      v
                         approved  or  limited
                                      │
                                      v
                         Public detail + TrustNote
                         "밈캐치 자체 제작"
                         contentDepth() still applies
                                      │
                                      x  /api/meme-studio  ──JSON only──> browser
                                      x  Creator Pack ──reviewed catalog──> Plus user
                                      x  MPE ingest ──third-party, 24h delete──> not this
                                      x  ranking JSONL ──triage, never publish──> not this
```

### Data model (additive)

`memes.origin_kind text not null default 'catalog'`
check in `('catalog', 'house_original')`.

House-original rights evidence (pick one, recommended A):

- **A (recommended):** reuse `meme_media` / `meme_sources` with `source_role='original'` and `rights_basis='creator_permission'`. Add `memes.house_rights_attested_at timestamptz`. Trigger: if `origin_kind=house_original` and new status in (approved, limited), require attestation timestamp + at least one original/creator_permission link.
- **B:** new `meme_house_rights` table. Cleaner isolation, extra JOIN, 1-person maintenance cost. Defer unless A cannot express “CatchMeme is the creator.”

Existing `rights_basis` values already include `creator_permission` (`supabase/migrations/20260824220000_mpe_pipeline.sql`). Do not invent a parallel enum.

`source_role='original'` already exists. Catalog rows today mostly have `usage_example` (DQ-007). House originals must not ship with that default.

### Create path vs submission path

Do **not** call `approveSubmission`’s three-step update loop for house originals.

Quoted hole (do not copy):

```240:244:lib/actions/admin.ts
    // 2) 검수 상태 전이 — 트리거가 역행을 차단하므로 순서대로 전진
    for (const status of ["fact_checking", "rights_checking", "approved"] as const) {
      const { error } = await supabase
        .from("memes")
```

That loop is one operator click from insert to public. Fine-ish for a sourced user submission the operator already reviewed in the form. Fatal for a claim of originality.

New action: `createHouseOriginal` → INSERT pending only.
Existing action: `transitionMemeStatus` → if row is house_original and `to` is approved/limited, require attestation payload; else keep current behavior.

Quoted transition today (no attestation):

```465:476:lib/actions/admin.ts
    const { error } = await supabase
      .from("memes")
      .update({ moderation_status: input.to, updated_at: new Date().toISOString() })
      .eq("id", input.memeId);
    ...
    await logAudit(uid, "meme.transition", "meme", input.memeId, { to: input.to });
```

DB trigger remains source of truth so a compromised or scripted client cannot skip rights. App-level check is UX; CHECK/trigger is the gate.

Quoted moderation machine (keep):

```11:16:supabase/migrations/20260727000000_unpublish_to_fact_checking.sql
    (old.moderation_status = 'pending' and new.moderation_status in ('fact_checking','rejected')) or
    (old.moderation_status = 'fact_checking' and new.moderation_status in ('rights_checking','rejected','pending')) or
    (old.moderation_status = 'rights_checking' and new.moderation_status in ('approved','limited','rejected','fact_checking')) or
```

### AI (optional, never publishing)

Studio already generates three Korean captions and does not persist them:

```11:16:app/api/meme-studio/route.ts
/** AI 밈 스튜디오 생성 엔드포인트 — IP당 시간 10회, 결과는 캐시하지 않는다. */
```

`generateDraft` already forbids auto-save. For house originals, if an operator wants a draft: new prompt “you are drafting CatchMeme-owned copy; do not invent an internet origin, first-seen year, or third-party rights holder.” Return JSON to the form. Same audit event family. No `memes` write inside the model helper.

Bedrock is allowed only for the admin house-original draft exception defined above. Do not connect it to public Studio, MPE, automatic publication, or a keep-forever render worker.

### Public surface

- TrustNote today has three evidence states (0 sources / context wiki / identified primary). House originals need a **fourth**: CatchMeme is the originator. Empty `meme_sources` must not show “출처를 아시면 알려 주세요” as if folk provenance were missing; it should show 자체 제작 + how to report misuse.
- `contentDepth()` / `isIndexableMeme()` unchanged (D-001). A two-line joke still should not hit the sitemap.
- Safety signals still human. Do not let the draft model set `safety_level` onto the row without operator edit (same as submissions).

### Failure scenarios (production)

| Path | Realistic failure | Plan account? |
| --- | --- | --- |
| createHouseOriginal | Duplicate slug 23505 | Retry suffix like `approveSubmission`; stay pending |
| createHouseOriginal | Non-operator POST | `requireOperator` already on admin actions |
| transition to approved | Missing rights row | Trigger exception; UI shows the trigger-friendly message |
| transition to approved | Double-click | Idempotent if already approved; unique audit ok |
| Studio POST | Caller expects dictionary insert | Stay JSON-only; test locks this |
| AI draft | Model invents a 2019 origin | Prompt + operator fact step; do not INSERT from draft |
| TrustNote | House row with 0 sources uses catalog empty-state | New branch required |
| Index | House original 80 chars of prose | `isIndexableMeme` false; page 200, noindex |

No new binary/package. CI is existing `pnpm test` / `tsc` / lint.

---

## Code quality

### Organization

Put provenance predicates in `lib/house-original.ts` (canPublishHouseOriginal, isHouseOriginal, trustCopyKind). Admin actions import them. TrustNote imports copy helpers, not SQL. Do not scatter `origin_kind === 'house_original'` across five pages without a helper (DRY).

### Do not over-engineer

No HouseOriginalService class tree. No event bus. No outbox for “originality.” Audit log already exists (`logAudit`).

### Under-engineered if skipped

UI-only checkbox with no DB trigger. That is how originality claims leak. Prefer explicit trigger over clever client state.

### Error handling

- Invalid transition: keep mapping `invalid moderation transition` → Korean message.
- Missing attestation: distinct message, not the generic transition error.
- AI draft failure: form stays empty; no partial row.

### ASCII in code

Add a short state diagram comment on `lib/house-original.ts` and next to the new trigger. Update if the machine changes. Stale diagrams are worse than none (`LOOP.md` / eng-review preference).

### Existing diagrams

`docs/architecture.md` source-pipeline paragraph should gain one sentence: house originals do not enter via oEmbed ranking. Update in the same implementation PR as the trigger, not a drive-by rewrite of the AWS sections.

---

## Tests (vitest)

Framework: `vitest.config.mts`, `pnpm test` (`vitest run`). SQL contracts already live as `supabase/*_contract.test.ts` string matchers against migration files.

### Coverage diagram (planned code + user flows)

```
CODE PATHS                                              USER FLOWS
[+] lib/house-original.ts                               [+] Operator creates house original
  ├── canPublishHouseOriginal()                           ├── [GAP] [→UNIT] pending insert only
  │   ├── [GAP] missing rights_basis                      ├── [GAP] [→UNIT] cannot jump to approved
  │   ├── [GAP] rights_basis=unknown/blocked              └── [GAP]        duplicate slug suffix
  │   ├── [GAP] source_role != original
  │   └── [GAP] attested + original + permission        [+] Operator rights step
  ├── trustCopyKind()                                     ├── [GAP] [→UNIT] attestation required
  │   ├── [GAP] house_original vs catalog                 ├── [GAP]        reject / back to fact
  │   └── [GAP] house + 0 folk sources                    └── [GAP] [→UNIT] audit log fields
  └── (no network)

[+] lib/actions/admin.ts                                [+] Public reader
  ├── createHouseOriginal()                               ├── [GAP] [→UNIT] TrustNote 자체 제작
  │   ├── [GAP] operator only                             ├── [GAP]        catalog empty-state unchanged
  │   ├── [GAP] origin_kind forced house_original         └── [GAP]        thin → noindex via contentDepth
  │   └── [GAP] status pending only
  ├── transitionMemeStatus()                            [+] Studio user (regression)
  │   ├── [★★  TESTED] generic transition (existing)      ├── [★★  TESTED] /api/meme-studio JSON
  │   ├── [GAP] **CRITICAL** house + approved w/o rights  ├── [GAP] **CRITICAL** studio does not INSERT memes
  │   └── [GAP] catalog path unchanged                    └── [★★  TESTED] rights checkbox on artifact PNG
  └── generateDraft/houseDraft
      ├── [★★  TESTED] submission draft no INSERT
      └── [GAP] [→EVAL] house prompt forbids folk origin

[+] check_moderation_transition + house guard           [+] Plus Creator Pack (regression)
  ├── [GAP] [→SQL contract] approved blocked              ├── [★★  TESTED] pack from reviewed facts
  └── [GAP] catalog approved still works                  └── [GAP] pack does not gain auto-post

LLM: [GAP] [→EVAL] house-original draft prompt — no invented year/rights holder

COVERAGE TODAY: studio/admin catalog paths exist; house-original paths are 0/planned
QUALITY TARGET: ★★★ on gate + TrustNote; ★★ on form UX; eval on prompt
GAPS: 16 (2 CRITICAL regressions to lock, 1 eval)
```

### Test files to add

| File | Assert |
| --- | --- |
| `lib/house-original.test.ts` | publish predicate true/false matrix; trust copy kind |
| `lib/actions/admin-house-original.test.ts` (or extend existing admin tests) | create leaves pending; transition to approved without attestation fails; catalog transition still works |
| `components/trust-note.test.tsx` | house original copy; catalog 0-source CTA unchanged |
| `supabase/house_original_contract.test.ts` | migration SQL contains origin_kind check + publish guard |
| `app/api/meme-studio/route.test.ts` | **CRITICAL regression:** mock supabase insert not called (already JSON; lock it) |

Eval: one fixture prompt + forbidden-output list (invented origin year, named third-party rights holder, `moderation_status: approved` in model JSON). Run only if a house draft helper ships.

No E2E required for v1 (operator-only, 1-person). Optional later: Playwright admin login is a Plus/auth human gate today; do not block this slice on it.

### Test plan artifact note

A QA-oriented copy of routes/interactions is also written under `~/.gstack/projects/` for `/qa` (eng-review-test-plan). In-repo source of truth remains this file.

---

## Performance

- Create/transition are single-row admin writes. No list N+1 introduced if the admin detail page already loads `meme_sources` in the same round-trip it needs for attestation UI. If it does not, **one** extra select by `meme_id`, not per-source chatty loops.
- Do not load all memes to filter `origin_kind` in memory. Admin list: optional `?origin=house_original` query on the existing 100-row list.
- Public Studio: existing hourly rate limit and template-only generation. Admin house drafts use the isolated Bedrock lifetime budget; they do not share an unlimited key or bypass the $100 hard cap.
- TrustNote is render-time, no extra public query if `origin_kind` is selected with the meme row (it already `select`s the meme).
- No new cache. `revalidatePath` already used after transition.
- Do not generate PNGs on the server in v1 (CPU on Vercel). Dictionary card stays client-side until a later R2 slice.

---

## Opinionated recommendations (tradeoffs)

1. **Provenance column, not a tag.** Tags are empty on the whole catalog (DQ-006) and mean “topic.” Originality is a legal/product invariant. Cost: one migration. Benefit: you cannot forget it in SQL.
2. **DB gate + UI checkbox, not UI only.** 1-person ops will one-click the wrong thing at 1am. Trigger is the tired-human design. Cost: migration care. Benefit: scripts cannot skip rights.
3. **Do not reuse `approveSubmission` walk.** Fast for sourced submissions; it is how originality becomes a lie. Cost: one extra click (fact, then rights). Benefit: the product still means “dictionary.”
4. **Studio stays ephemeral.** Wiring PNG download → `memes` insert would turn a user tool into un-reviewed UGC publication. Plus/Studio users are not operators.
5. **Creator Pack stays catalog-to-share.** Mixing house originals in later is a product choice; v1 must not auto-post anywhere (already Plus policy).
6. **Same content-depth gates.** House originals that are jokes with no prose should not get sitemap privilege. Otherwise this becomes a thin-content faucet and DQ-002 gets worse.
7. **Ops cadence is a calendar, not cron.** “Weekly house meme” as a job will post garbage when the operator is away. Manual create is the reversible path.
8. **No new image model.** CatchMeme graphics already exist in ArtifactStudio dictionary mode. Generated images of existing meme characters are a rights swamp (see `ai-slop` / italian-brainrot catalog rows already marked limited + IP caution).

Lake score: 8/8 recommendations chose the complete **minimal** option over a platform shortcut.

---

## NOT in scope

| Item | Why deferred |
| --- | --- |
| Auto-publish of AI drafts | LOOP.md rule 4 |
| Production SQL apply / deploy | Human gate; this review does not write prod |
| New SNS/auto-post pipeline | Plus already no-auto-posting; 1-person blast radius |
| MPE fork / keep-forever ingest | MPE deletes originals at 24h; wrong lifecycle |
| Plus Creator Pack generating dictionary rows | Pack is subscriber export of reviewed catalog facts |
| AI backfill of DQ-002 thin catalog docs | Different problem; would be unlicensed-looking slop |
| User Studio → public `memes` insert | UGC publication without operator fact/rights |
| Image-generation API / Bedrock media generation | Rights unclear; the approved Bedrock exception is text-only admin drafting |
| Weekly cron “ship a house meme” | Posts when nobody is watching |
| Changing safety-scale math (HG-002/003) | Separate HUMAN_GATE data work |
| Translation auto-publication | Existing human translation gate |
| Ranking JSONL as originality proof | Explicitly triage-only |
| New microservice / queue product | 0 new services in minimal version |

---

## What already exists

Covered in Step 0 table. Short list: moderation trigger, `transitionMemeStatus`, Studio JSON API, ArtifactStudio dictionary graphics, `generateDraft`, `rights_basis`/`source_role` enums, `contentDepth`, Creator Pack, MPE (do not reuse for this), admin unsourced queue (catalog).

---

## Inline diagrams to add during implementation

- `lib/house-original.ts` — state machine (pending → fact → rights → public)
- New migration — comment on the publish guard
- `docs/architecture.md` — one sentence that house originals skip oEmbed ranking

---

## Failure modes (test × handling × user)

| Failure | Test | Handling | User sees |
| --- | --- | --- | --- |
| Approve house original without rights | **CRITICAL** unit + SQL contract | Trigger + action error | Korean error, stays rights_checking |
| Studio POST inserts meme | **CRITICAL** regression | No insert code | Captions only |
| AI draft invents origin year | eval + fact step | Not written to DB | Operator still in form |
| Duplicate slug | unit | suffix retry | Created pending |
| Non-operator create | existing requireOperator pattern | throw | login/forbidden |
| Thin house original indexed | contentDepth reuse | noindex | Page 200, not in sitemap |
| TrustNote catalog copy on house row | unit | new branch | 자체 제작 |
| Double-click approve | transition noop/idempotent | trigger same status returns | no duplicate published_at surprise (trigger only sets if null) |

No silent failure on the publish path. Missing attestation is a **critical gap** if unimplemented.

---

## Worktree parallelization

Skip full parallelization: shared `lib/actions/admin.ts` and `memes` schema. Sequential.

| Step | Modules | Depends on |
| --- | --- | --- |
| Migration + types | supabase/, database.types | — |
| Helpers + tests | lib/house-original.ts | migration shape |
| Admin create + transition | lib/actions/admin.ts, admin components | helpers |
| TrustNote + labels | components/trust-note.tsx, lib/labels.ts | helpers |

Lane A only. Sequential implementation, no parallelization opportunity without merge conflict on admin actions.

---

## Implementation Tasks

Synthesized from this review’s findings. Each task derives from a specific finding. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~2h / CC: ~20min)** — schema — Add `origin_kind` + house publish guard
  - Surfaced by: Architecture — UI-only originality is not a gate
  - Files: `supabase/migrations/*_house_original_provenance.sql`, `supabase/house_original_contract.test.ts`
  - Verify: `pnpm exec vitest run supabase/house_original_contract.test.ts` (and local supabase test if used)
- [ ] **T2 (P1, human: ~2h / CC: ~25min)** — admin actions — `createHouseOriginal` pending-only; gate `transitionMemeStatus`
  - Surfaced by: Architecture — `approveSubmission` three-step walk must not be copied (`lib/actions/admin.ts` ~240)
  - Files: `lib/house-original.ts`, `lib/actions/admin.ts`, action tests
  - Verify: `pnpm exec vitest run lib/house-original.test.ts lib/actions/admin.ts` (or dedicated test file)
- [ ] **T3 (P1, human: ~1h / CC: ~15min)** — TrustNote — house original public copy
  - Surfaced by: Architecture / Code quality — empty catalog CTA would lie
  - Files: `components/trust-note.tsx`, `components/trust-note.test.tsx`, `lib/labels.ts`
  - Verify: `pnpm exec vitest run components/trust-note.test.tsx`
- [ ] **T4 (P1, human: ~45min / CC: ~10min)** — regression — Studio API never writes `memes`
  - Surfaced by: Tests — CRITICAL lock on `/api/meme-studio`
  - Files: `app/api/meme-studio/route.test.ts`
  - Verify: `pnpm exec vitest run app/api/meme-studio/route.test.ts`
- [ ] **T5 (P2, human: ~2h / CC: ~20min)** — admin UI — 자체 제작 form + attestation on status controls
  - Surfaced by: Code quality — tired-human 1am click
  - Files: `components/admin/house-original-form.tsx` (new), `components/admin/meme-status-controls.tsx`, `app/(default)/admin/memes/`
  - Verify: component tests + `pnpm exec tsc --noEmit`
- [ ] **T6 (P2, human: ~30min / CC: ~5min)** — docs — architecture sentence + DECISIONS D-house-original
  - Surfaced by: Code quality — diagram maintenance
  - Files: `docs/architecture.md`, `docs/renewal/DECISIONS.md`
  - Verify: read-through; no production SQL
- [ ] **T7 (P3, human: ~1h / CC: ~15min)** — eval — house draft prompt forbids folk origin (only if draft helper ships)
  - Surfaced by: Tests — [→EVAL]
  - Files: draft helper + eval fixture
  - Verify: fixture fails if output contains a fake year/rights holder

_No extra performance tasks._ N+1 (one query per related row in a loop) is avoided by selecting `origin_kind` on the existing meme query.

---

## Suggested implementation order

1. Migration + contract test (T1)
2. Pure helpers + tests (T2 partial)
3. Actions + transition gate (T2)
4. TrustNote (T3) + studio regression (T4)
5. Admin UI (T5)
6. Docs (T6)
7. Optional draft eval (T7)

Stop condition: focused vitest + `tsc --noEmit` + lint on touched files. Do not apply production SQL. Do not claim `CATCHMEME_RENEWAL_DONE`.

---

## Completion summary (eng review)

- Step 0: Scope Challenge — complexity smell triggered; **minimal version recommended and used as the plan** (not silent cut of the full platform)
- Architecture Review: 8 issues (folded as defaults)
- Code Quality Review: 5 issues (folded as defaults)
- Test Review: diagram produced, 16 gaps identified (2 CRITICAL)
- Performance Review: 3 issues (folded as defaults; no extra tasks)
- NOT in scope: written
- What already exists: written
- TODOS.md updates: skipped (no TODOS.md; BACKLOG catalog items not bundled)
- Failure modes: 2 critical gaps flagged if unimplemented
- Outside voice: attempted after write
- Parallelization: 1 lane, sequential
- Lake Score: 8/8 recommendations chose complete minimal option

### Outside voice (Codex, informational — not auto-applied)

Codex `gpt-5.6-sol` high, read-only, 2026-08-29. Full output captured in session logs. Eight problems; not folded into architecture without parent/user confirmation.

1. P0 — v1 stores a labeled document, not a durable house asset (Studio PNG never hits the server).
2. P0 — UPDATE-only moderation trigger can be bypassed via direct approved INSERT, flipping `origin_kind` on a live row, or deleting rights after approve.
3. P0 — `meme_media` requires `media_sources.source_id` (`supabase/migrations/20260723120000_source_pipeline.sql:77-79`) and defaults `review_state='pending'` (`:102`). Plan option A does not match that schema.
4. P0 — `logAudit` is a separate service-role insert after status update (`lib/actions/admin.ts:50-64`, `:465-476`). DB cannot require “uid in audit log” in that order.
5. P1 — edit RPC can change copy after attestation without reverting to `rights_checking`.
6. P1 — regex/contract tests do not prove trigger/RLS/INSERT/revoke behavior.
7. P1 — TrustNote is not passed provenance today (`app/(default)/memes/[key]/page.tsx:449-455`); cards/search/JSON-LD would still look like catalog.
8. P2 — shipping a provenance platform before one real house meme has use-signal may be the wrong first week of work.

Recommended defaults if parent auto-decides: accept 2–6 as T1/T2 hardening; keep v1 without a new R2 renderer by using `meme_sources` + CatchMeme canonical URL rather than `meme_media`; TrustNote + detail origin line only; do not block the slice on a content experiment, but do not auto-post.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run (office-hours skipped per user 진행해줘) |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | 8 findings (4 P0, 3 P1, 1 P2); not auto-applied |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | locked | 16 issues folded as recommended defaults; 2 critical test gaps planned; complexity smell → minimal version; D3=A 2026-08-29 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | suggest after admin form + TrustNote UI |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not required |

- **CODEX:** House original is a label without a durable asset; UPDATE-only gate is bypassable; `meme_media` FK/`review_state` mismatch; audit is not atomic with publish; tests too weak; TrustNote surface incomplete; product-order risk.
- **CROSS-MODEL:** Eng review said reuse `meme_media` + update trigger + contract tests + no R2. Codex says that gate is bypassable, the ledger FK does not fit, and v1 is prose-not-content. Eng still prefers no generation factory and no auto-publish. Tension is how to prove originality without a new media stack.
- **VERDICT:** ENG REVIEW LOCKED — minimal house-original slice; all 12 defaults accepted 2026-08-29 (D3=A). Ready to implement T1→T6.

NO UNRESOLVED DECISIONS
