# Loop 148 execution plan — performance · data quality · design · features

Date: 2026-08-28  
Grounding: `LOOP.md`, `docs/renewal/{LOOP_STATE,BACKLOG,RELEASE_CHECKLIST,DECISIONS}.md`, radar QA under `.omo/evidence/radar-qa/`, TikTok oEmbed candidates collected 2026-08-28.

Loop 147 (`PLUS-060`) is `code_complete`. This loop does **not** invent a new Plus surface. It takes the next **unblocked** slices from existing planning that still move all four requested workstreams.

## In scope (this loop)

| Priority | ID | Workstream | Slice | Success criteria |
| --- | --- | --- | --- | --- |
| 1 | PERF-002-lite | Web performance | AuthInvite session pending currently renders nothing, then inserts ~176px for guests (loop-023 HG-005 §3-B). Reserve the **same card markup** invisibly until guest/member is known. Do **not** move the card below the 2-column grid (3-A is a conversion decision; keep “정답 카드 직후”). | Guest: no first-viewport insert. Member still collapses (documented tradeoff). Tests cover pending/guest/member. |
| 2 | DQ-C1-ops | Data quality | (a) `rank-social-source-candidates.mjs` ignores `tiktok-public-oembed-*.jsonl`. Include it and emit a review-only ranking file. Never write Supabase. (b) Quality-check DQ-C1 samples are arbitrary; sort by `trend_score` so operators open high-traffic unsourced docs first (LOOP.md Phase 3). | Ranking regex + test. Review JSONL exists. `buildChecks` samples are trend-desc. |
| 3 | DES-empty-error | Design renewal | Gate C still lists loading/empty/error/zero-result as unverified. Explore already has empty + load-more error; lock them with tests and keep AuthInvite reservation visually identical to the guest card (no empty gray box). | ExploreGrid empty + failed accessible copy tests pass. AuthInvite pending uses real card chrome. |
| 4 | ADMIN-Q-001 | Feature (Phase 3) | LOOP.md Phase 3: operators must auto-discover high-view thin/unsourced docs. `/admin/memes` has search + moderation filter only. Add read-only `focus=unsourced` queue ordered by `trend_score`, linked from the admin dashboard. No production write, no publication. | Pure helper tests + admin list + dashboard tile. |

## Out of scope (explicit)

- HUMAN_GATE: HG-001~HG-004 data backfill, HG-005 ad *placement* change (C already shipped in loop 047), HG-006 analytics events, SEO-001 soft-404, translation publication, production deploy, Plus payment/RLS E2E.
- PERF-002 3-A (move AuthInvite below media) — conversion-affecting product decision; not taken here.
- Radar live TikTok connector (no official Display API in `createConfiguredRadarConnectors`; collected README forbids scraping). Local Supabase Radar DB scenario remains blocked (`RADAR-009`).
- Catch-all visual rewrite (DES-WEB3-V2 already done in loop 046).
- Committing, pushing, or applying SQL to production.

## File ownership

| Slice | Primary files |
| --- | --- |
| PERF-002-lite / DES | `components/auth-invite.tsx`, `components/auth-invite.test.tsx` |
| DES-empty-error | `components/explore-grid.test.tsx` |
| DQ ranking | `scripts/rank-social-source-candidates.mjs`, `.test.mjs`, `data/memes/review/social-source-ranking-tiktok-public-oembed-2026-08-28.jsonl`, `data/memes/review/README.md`, `data/memes/collected/README.md` |
| DQ samples | `scripts/quality-check.mts`, `scripts/quality-check.test.ts` |
| ADMIN-Q-001 | `lib/admin-quality-queue.ts`, `lib/admin-quality-queue.test.ts`, `app/(default)/admin/memes/page.tsx`, `app/(default)/admin/page.tsx` |

## Risks

- Logged-in users still get a small CLS when the reserved invite collapses (3-B tradeoff).
- Unsourced admin query over-fetches (300) then filters in memory — PostgREST has no cheap “empty embed” predicate.
- Ranking file is review-only; auto-promoting oEmbed hits would violate LOOP.md rule 4.

## Stop condition

Focused tests + tsc + lint on touched files. Full `pnpm test` / build if time allows. Do not claim `CATCHMEME_RENEWAL_DONE`.
