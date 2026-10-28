# Media recovery: safe root integration and public visibility correction

Date: 2026-10-18, Asia/Seoul. This is a local implementation and fresh read-only
production observation, not a completed catalog recovery or a new deployment.

## Actual progress

The existing Herdr branches were preserved and rechecked concurrently:

| Branch | Test pane | Fresh offline result |
| --- | --- | --- |
| `codex/media-detail-cleanup-20261014` | `w7:p2` | 6 Vitest files, 33 tests passed |
| `codex/media-recovery-ledger-20261014` | `w8:p2` | 5 Vitest files, 77 tests passed |
| `codex/media-oembed-safety-20261014` | `w9:p2` | 23 Node tests passed |

These panes ran shell tests, not interactive coding agents. Native specialists
performed the bounded integration, independent public-delivery audit, application
fix, SQL fix and source research. No existing pane was closed or security dialog
answered. The original dirty `main` checkout and unrelated changes remain intact.

Comparison with the isolated social branch found two missing safety integrations
in the root working copy. Only the corresponding source/test files were merged
with reviewed patches; no whole-worktree copy, merge commit, push or install ran.

## Changed files and behavior

- `scripts/import-source-candidates.mjs` and its test: default read-only plan;
  explicit `--execute --limit=1 --meme-id=<uuid>` required for a single new
  Instagram/TikTok candidate. Exactly one reviewed, non-phrase video/embed parent
  is required. Existing identities are skipped, not overwritten. New links remain
  `pending` with `rights_basis=unknown`. No provider calls occur in this importer.
- `scripts/verify-oembed-sources.mjs` and its test: Instagram is review-required
  with no provider calls/writes from this CLI. Every TikTok oEmbed error,
  including 404, stays deferred; none means private/deleted. Successful validation
  requires the exact blockquote ID and normalized canonical cite, uses a 256 KiB
  streaming response ceiling, and stores only embed-validation fields rather than
  provider text. Existing exact-source, explicit-execute and dry-run gates remain.
- `README.md`: replaced the obsolete importer `--dry-run` example with the actual
  plan and single-candidate execute syntax. YouTube is still a separate collector.
- `lib/video-production/public.server.ts` and its test: rejects all non-public
  produced-video rows before deduplication. An earlier hidden duplicate cannot
  hide a later valid public row.
- `components/meme-produced-videos.tsx` and its test: independently rejects forged,
  malformed and non-public input before rendering. Unlisted/private yield neither
  iframe nor VideoObject. Public playback retains its existing fallback; VideoObject
  still separately requires strict public embed proof and valid real metadata.
- `supabase/migrations/20261018095034_public_produced_video_visibility.sql`:
  CLI-generated forward migration, prepared locally only. Replaces the existing
  public view with identical columns and security/hash/rights/approval/proof gates,
  narrowing the final privacy predicate to `public`. It does not alter publication
  rows, operator previews, upload queues, customer data, or worker approval rules.
- `supabase/video_production_pipeline_contract.test.ts`: tests the forward view.
- `supabase/tests/video_public_projection.local.sql`: unlisted must be absent
  under the anon role, rather than the former visible-without-schema expectation.
- `scripts/public-produced-video-visibility.runtime.test.mjs`: disposable real
  PostgreSQL, no app credentials, no TCP listener, actual rights function and view
  definitions extracted from the migrations. Baseline → forward → forward proves
  the old behavior and the idempotent fix within a minimal local fixture.

Flow: exact operator URL → bounded plan → optional explicit pending intake →
source/rights/semantic review → existing atomic approval → original-media public
filter. Produced videos use a separate public-only view → runtime DTO validation →
defensive public player → separately verified VideoObject. There is no automatic
approval, platform-score combination, download, editing or upload in these changes.

## Fresh production evidence, not playback proof

Read-only SELECTs on project `onjipuldngbdptldkpoe` observed:

- At `2026-10-18T09:46:38.887768Z`, 도마도마 has no source ledger and no approved
  live video child. IU, Na-molla Family and SHINHWA each still have zero such
  children. IU and Na-molla's stored sources are non-embeddable and expired;
  SHINHWA's stored source expired October 11. None of this proves private/deleted
  status. Inherited `official_embed` is not independently verified provenance.
- The requested 씬포켓 channel candidate `PRHgGhd7nW8` remains pending with unknown
  rights, and has zero matching approved/live children. Its Whiplash parent has
  two other approved/live children; that count is not publication of this candidate.
- At `09:50:14.755062Z`, the actual existing view definition allowed public and
  unlisted. At `09:50:54.059120Z`, the view returned **0 rows**, including **0
  unlisted rows**. This is a latent exposure condition, not observed live disclosure.
- Early multi-statement diagnostic calls returned only the final statement's result.
  Their absence of a view-definition result was not evidence of a missing view.
  Single-statement `to_regclass` and `pg_get_viewdef` checks corrected that ambiguity.

Evidence is saved at
`artifacts/release/20261018-media-recovery/safety-integration-and-source-recheck.json`.
No production write, metadata refresh, new approval or deployment occurred.

The October 14 classification proposal integrity check also passed for all 115
remaining rows. With the earlier 12, there are 127 proposals: 66 video-demonstration
priorities, 53 optional/context entries, 8 identity holds, **0 operator approvals**.
These are historical backlog proposals, not a fresh whole-catalog audit or 127
proven missing videos. Stored origins/dates/popularity were not fact-checked by
the excerpt validator and no parent classification was changed.

## Source research and unresolved recovery

A bounded researcher found IU Good Day MV `jeqdYqsrsA0` as a candidate work/ID
lead. A [contemporaneous Universal Music release notice](https://prtimes.jp/main/html/rd/p/000000378.000000664.html)
links that ID, but present uploader/API metadata, the exact climax, public/embed
state, Korea playback and rights still require their separate checks. No candidate
was inserted or approved. No exact alternate SBS sketch or official SHINHWA chair
performance was established; official audio and a different act's cover were rejected.

The researcher used 9 search terms against a requested cap of 8, reported the
one-term overrun and stopped. These were public web searches, not authenticated
YouTube Data API calls. This deviation is recorded rather than reported as within
budget. No search result was treated as current playback or rights clearance.

## Verification

- Root source importer/oEmbed/normalization: 23/23 Node tests passed.
- Existing YouTube discovery, refresh, pending verification and human-publication
  contract: 29/29 Node tests passed, with mocked providers and no live calls.
- Public delivery, both detail routes, original embeds, produced video, JSON-LD,
  safety and concise-copy regressions: 14 files, 163 tests passed.
- Focused forward-view, produced-reader/player and JSON-LD: 4 files, 74 tests passed
  (overlap with the preceding run; not additional unique test coverage).
- Editorial review validator: 17/17 tests passed; actual 115-row batch validation
  and combined 127-row unique-identity/unapproved-count check passed.
- Real PostgreSQL: 11 checks passed, including baseline unlisted exposure,
  corrected public/unlisted/private behavior, hash/approval/rights/child gates,
  latest false proof and actual anon rights-predicate access. The sandbox first
  denied initdb shared memory; the authorized isolated rerun passed and stopped.
- TypeScript passed. Targeted ESLint, Node syntax and scoped diff checks passed.

The fixture is not a full Supabase/RLS/migration-chain/concurrency test. No new
authenticated admin browser save, public production HTML audit, mobile/reduced-
motion QA on a new release, live oEmbed/API call or whole-catalog playback pass
is claimed. Independent final review passed with no actionable defect in the
public reader/player/forward-view scope. Its normalized view comparison proved
that only `CREATE OR REPLACE` and the allowed public-only predicate differ from
the baseline definition; its focused 74-test, TypeScript, lint and isolated
PostgreSQL checks also passed. That is local code approval, not source/rights
approval or production rollout proof.

## Schedule, credentials, activation and rollback

No new schedule, dependency, API subscription, environment variable or paid service.
Existing server-only source tooling uses `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`; YouTube collection additionally uses its existing
`YOUTUBE_API_KEY` and source policy gates. No credential values were printed.
Plan mode may read the DB; it does not mean zero external reads.

The new public-view migration requires scoped operational approval and a final
deployed-definition drift check. The existing collection eligibility/repair SQL
and a further source canary retain their separate approval gates. A proposed raw
metadata check is one request for at most five named video IDs, not open-ended
search or permission to write source state. Web changes need an isolated allowlist
release and its mobile/reduced-motion/console verification, never a dirty-tree deploy.

Local rollback is a reviewed patch of these exact hunks/files, preserving unrelated
work and the initial historical video migration. No DB rollback is needed before
activation because none was applied. After an approved rollout, retain the narrower
public-only view even if rolling back a web build; restoring the old view would
reopen unlisted exposure. Do not drop tables, erase audit history, reset parent
classifications, rotate keys or alter existing publications as rollback.

The goal remains incomplete: exact replacements, meaningful per-item review,
approved activation, further playback checks, classification decisions and channel
candidate rights review are still required. Passing local gates is not recovered
production media.
