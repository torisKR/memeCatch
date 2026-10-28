# Media recovery gap audit — 2026-10-14

This is a read-only production snapshot, not proof of completed restoration.
Project: `onjipuldngbdptldkpoe`; public alias: `catchmeme.com`.

## Current evidence

- The live alias still points to `dpl_626e9JRnENohCMujGxyF2Nw7nuYo`, the
  `youtube-raw-27a66c393f86` baseline. Later local media patches are not live.
- Existing classification (`category <> phrase`, `media_type = video`,
  approved/limited parent) selects 1,197 documents. Twenty have no approved
  live video/embed child. This is an editorial shortlist: stored classification
  does not by itself prove that every document needs a video.
- Nineteen of those twenty already have an approved `meme_media` ledger link.
  An approved link is not a public `meme_contents` projection, or playback proof.
- `나빌레라` has an approved official-embed usage link to `YtK3Vtw4rno`;
  `신화 - Wild Eyes 의자 퍼포먼스` has one to `gFT1mEtk3VA`. Both source
  rows currently say public/embeddable/not removed, while the documents have
  no approved live video child. Semantic suitability and fresh provider state
  must still be reviewed before publication repair.
- `Young한데 완전 MZ인데요` references `YNOBV_uVzeY` in its approved ledger;
  the source explicitly says unlisted and non-embeddable. Do not resurrect it.
- There are 1,245 unresolved `db_failure` recovery records. The approved
  one-source canary target `cbbfcba5-c980-4b49-b536-19b3a1057282` is public
  and embeddable after its provider check, but its recovery is still unresolved.
- The requested operator channel is `UCBSPgsi3DjJ0-EUEA-Spjug` (씬포켓).
  Its `PRHgGhd7nW8` candidate is still pending/unknown-rights and has zero
  approved public video children. No inferred underlying rights clearance.

## Bugs and local changes

1. Recovery filtering after the RPC's row limit missed the scoped target.
   Scoped server filters repair that lookup; no second live canary was run.
2. Increasing stale/due lookahead alone does not solve starvation under stable
   ordering. Eligibility must precede the SQL limit. A local additive,
   service-role-only candidate RPC and filtered active-recovery query passed
   focused tests and an isolated PostgreSQL test with 1,001 blocked rows before
   the eligible candidate; they are not installed in production.
3. The deployed atomic approval function returns early for identical approved
   retries, even if public projections are missing. A separate local corrective
   migration passed 65 local SQL assertions with rollback for explicit
   operator-triggered missing-projection repair only. Existing conflicting
   projections fail closed; production installation remains outstanding.
4. Social URL intake now defaults to plan-only, exact one-meme/one-candidate
   execution, non-phrase video document eligibility and pending/unknown-rights
   links. No provider search, enrichment, automatic publication or updates to
   existing sources. Instagram/TikTok errors are not deletion evidence.
5. Canary guards are locally tightened to the exact source ID, YouTube source
   key/platform, video ID and target URL aliases. Adversarial cases use fresh
   guards rather than accidentally testing the one-call cap. Live execution is
   skipped without explicit sentinels and renewed scoped authority.
6. The latest independent Herdr review exposed an SDK count-option mismatch,
   unsupported social work filling the shared due limit, and a NULL-permissive
   SQL assertion. All three are corrected locally; installed-SDK transport
   tests and the temporary PostgreSQL runtime check pass.
7. A failed public-media ledger read previously preserved playback as well as
   citations. The local correction preserves stored data/citations but defers
   embed contents until the state can be read. Two regression cases verify
   returned/transport errors and full DTO immutability, including safety,
   lifecycle, and canonical fields. It makes no deletion/private assignments.
8. Local QA's generic env loader selected a configured server credential that
   returned HTTP 401. The existing project-bound content-env resolver selected
   a valid credential (one-row read HTTP 200). The local launcher now reuses
   that resolver, forwards no provider keys, and preloads a tested fetch guard
   rejecting non-GET/HEAD/OPTIONS methods. No production key was rotated.

## Remaining release gates

- Freeze and independently review final local diffs and SQL behavior.
- Reassemble only allowlisted files over the exact production baseline.
- Re-run local mobile/reduced-motion/console/detail QA on that exact build.
- New eligibility/repair migrations require their own production authority;
  the earlier approval was for the initial atomic/public-read migration.
- Renew permission before another provider/write canary; do not overwrite its
  previous failure report or run a bulk refresh.
- Operator source/rights/semantic review remains mandatory before new media
  becomes public. Missing-media counts do not establish semantic suitability.

No production writes, new approvals, uploads or deployment were performed
while collecting this snapshot. Local changes remain isolated or explicitly
scoped; never deploy the whole dirty checkout.

## Refreshed after web promotion — 06:11–06:14 KST

Earlier baseline/no-deployment statements above are historical. Provider alias
read at `2026-10-13T21:10:46.082Z` confirms `catchmeme.com` now targets
`dpl_Agvr1Kx9UsuQtRmkcpVPwV2KwQoj`, release `media-recovery-b454fc29a8fc`.
Anonymous production QA passed 24/24 on the unchanged-harness repeat; all main
documents returned 200 with this release header. This establishes the scoped
web release, not complete restoration or third-party video playback.

The read-only DB count at `2026-10-13T21:11:23.416908Z` still finds 1,197
non-phrase, approved/limited `media_type=video` documents and 20 without an
approved live video/embed child. Nineteen have an approved ledger link, but
they are **not nineteen publishable or readily recoverable videos**:

| Recorded state | Documents | Next safe step |
| --- | ---: | --- |
| Embedding unavailable | 10 | Find a semantically matching allowed replacement; do not force an iframe |
| Recorded removed | 3 | Research replacements; do not revive the removed source |
| Unlisted/private | 3 | Keep suppressed; review a different public source |
| Public + embeddable, missing projection | 3 | Fresh provider/semantic review, then explicit operator projection repair |
| No approved source ledger | 1 | Source research and pending intake before review |

The three projection candidates are `7yaqepcn` / `xOqbLdhvxlE`, `f384zwnp` /
`YtK3Vtw4rno`, and `yp9aj4pw` / `gFT1mEtk3VA`. The last candidate's stored
metadata expired on October 11; recorded public/embeddable is not fresh playback
proof. The no-approved-ledger entry is `2au7br9f` (도마도마 챌린지).

Fresh pending-source read at `2026-10-13T21:13:42.917830Z` confirms the requested
channel's `PRHgGhd7nW8` is public/embeddable in stored metadata but remains
pending, unknown-rights and has zero approved public children. Channel ownership
does not establish rights in the underlying performance. It was not published.

Fresh function inspection confirms only the initial `review_meme_source_atomic`
and `list_active_source_acquisition_recovery` are installed. The eligibility
and projection-repair changes, and further canary, remain unapplied/unrun.
Source research is proceeding separately without credential/provider calls,
downloads, writes or automatic publication. The historic unresolved-recovery
count above was not refreshed and must not be described as current.

## Actual production playback follow-up — 2026-10-14

Aside session `lvP3pWiKOwU8Wdvt` inspected the already-public 새삥 and Whiplash
detail pages with normal UI Play/Pause. The exact expected YouTube IDs matched:
`JnQu_5O4lh4` (The CHOOM) progressed from 0 to 20 seconds and was paused at
23 seconds; `jWQx2f-CErU` (SMTOWN) progressed from 0 to 9 seconds and was
paused at 17 seconds. Both pages retained `써도 됨` and Life signal `식는 중`.
The Whiplash screenshot visibly shows the paused player at `0:17 / 3:11`.

This closes the earlier playback gap for **these two YouTube embeds only**.
It does not establish whole-catalog recovery, Instagram/TikTok playback,
underlying rights clearance or verified audio. The already-rendered TikTok
player was not activated. Pending/suppressed IDs were absent from the inspected
page text/iframe sources, not a new corpus-wide or raw-HTML suppression test.
No source approval, migration, canary rerun, upload or deployment was performed.

Evidence: `artifacts/release/20261014-media-recovery/production-playback-qa-20261014.json`.

## Classification coverage audit — 06:15 KST

The video-only shortlist is **not the full goal boundary**. A separate read-only
cross-classification audit at `2026-10-13T21:15:40.565627Z` found:

| Parent category stored as image/text/audio | Review candidates | Without approved live video/embed child |
| --- | ---: | ---: |
| challenge | 64 | 44 |
| dance | 32 | 30 |
| song | 67 | 53 |
| Total | 163 | 127 |

These are **classification-review candidates**, not 127 proven missing videos.
Examples include text-classified Bboom Bboom, Blinding Lights, How You Like That,
Renegade, Wednesday and ETA dance challenges; other rows include image-based
participation formats or broad historical trends where a video may be optional.
Do not automatically overwrite parent classifications or insert unrelated clips.
The same audit found no approved non-phrase `media_type=embed`/audio parents;
the current stored types are 1,197 video, 571 image and 271 text.

Reuse `scripts/discover-youtube-candidates.mjs` rather than adding another
collector: it already has an explicit, UUID-scoped `--editor-video-classified`
option, `--plan-only`, and a single-channel/single-meme execution gate. A human
semantic classification decision is still required before using the override
for real collection. The existing Instagram/TikTok importer intentionally
retains its stricter eligible-parent gate; no automatic override was added.

Independent offline verification passed the existing discovery suite, rejected
a phrase even with the editor override, and proved the injected pure
`runDiscovery(planOnly)` made zero provider/write callbacks. The CLI entry point
still performs three Supabase REST reads before returning its plan: **plan-only
means no YouTube calls and no writes, not no external reads**. The editor flag is
a transient trusted-operator assertion; it does not validate or persist a review
record or reviewer identity. Record that human decision in the existing review
workflow before real collection; do not claim an automated semantic gate exists.

Full recovery remains unproven until the classification-review backlog as well
as the stored-video shortlist have been addressed. No root classification,
source or publication row was changed by this audit.

## Uncapped repeatable audit implemented and exercised — 06:30 KST

The existing discovery CLI now supports an uncapped, sanitized `--audit-only`
report. It reuses the two existing paginated database collections, excludes
phrases, separates classification review and pending backlog, and does not
require an enabled YouTube collector or a YouTube key. It performs no provider
search, refresh, mutation, classification update or publication.

```sh
node scripts/discover-youtube-candidates.mjs --audit-only
node scripts/discover-youtube-candidates.mjs --audit-only --meme-id=<uuid>
```

Audit mode rejects execution, dry-run, plan-only, channel, max, delay and editor
override options rather than silently ignoring them. Required existing env names:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required by the
existing project-bound loader), and `SUPABASE_SERVICE_ROLE_KEY`. Credentials stay
server-side; no values are printed or written in the report. No new env setting,
dependency, collector, queue, schedule or schema was introduced.

The leader exercised the audit runner and shared option parser against project
`onjipuldngbdptldkpoe`, with a fetch guard restricting origin, the two table paths,
GET, no redirects and at most 32 requests. The actual read window was
`2026-10-13T21:30:21.623Z`–`2026-10-13T21:30:33.025Z`: **12 DB GETs, 0 provider
requests, 0 writes**. Deterministic pagination is best-effort, not a transactional
snapshot. Scope is the 4,394 approved/limited documents, not pending/rejected
documents and not an assertion that all non-phrase content needs video.

| Stored-state bucket | Documents | Interpretation |
| --- | ---: | --- |
| Published media | 1,348 | Stored approved/live child with no matching explicit bad state; not fresh playback proof |
| Reviewed source / missing projection | 2 | Stored source passes canonical identity and approval-RPC metadata age limits; still needs semantic/provider review and authorized repair |
| Missing source or replacement/revalidation | 18 | Includes 1 missing ledger, 1 expired reviewed source, 3 removed, 3 unlisted and 10 other non-embeddable sources |
| Classification review | 127 | Non-video-classified challenge/dance/song without a usable published video; not automatically video-required |
| Recent pending backlog | 0 | Under the existing seven-day criterion in this read window |
| Excluded/nonvisual | 2,899 | Phrases and other currently non-video/unclassified documents |

The two stored-condition projection candidates are 나빌레라 and 번복진트
쇼미더산. Wild Eyes is **revalidation required**, not repair-ready, because the
metadata has expired. An additional 36 already-published challenge/dance/song
documents retain a classification warning without being counted as missing.

Independent review caught and corrected initial audit errors: TikTok/Instagram
identity matching, playback-ID/URL contradictions, ledger-only bad-state reasons,
and stale/canonical-invalid source readiness. Matching private/unlisted/removed
or non-embeddable sources are not counted as usable; unrelated sources cannot
suppress a different valid video. Null or failed observations are not deletion
evidence. Final review passed. Regression suites, Node syntax, ESLint and scoped
diff checks passed; the existing public-filter/recovery/refresh/YouTube suites
also passed 72/72. Pipeline tests separately passed 18/18 in independent review.

Evidence: `artifacts/release/20261014-media-recovery/uncapped-media-audit-20261014.json`.
It stores actionable rows and the 36 classification warnings, with the large
published/excluded row buckets intentionally omitted but their counts preserved.
This actual execution preceded a final reason-only cleanup; the artifact records
that fact instead of rewriting observed output. The final local code no longer
adds generic unknown reasons alongside a known linked bad state. No second live
read was needed for that formatting fix.

The new audit code is local and was not deployed or scheduled. The earlier
production web release and its suppression rules remain unchanged. New DB
eligibility/projection-repair migrations, rerunning the failed source canary,
full replacement research, classification review, and the operator-channel
candidate's source/rights approval remain outstanding. No new approval or
publication occurred. Local rollback means removing only the new audit hunks
with a reviewed patch; do not reset these already-dirty files or the worktree.

## Correction: two existing blocked projections, not absent projections — 06:39 KST

The preceding full audit artifact is retained as historical observed output. A
subsequent scoped production SELECT found that both 나빌레라 (`YtK3Vtw4rno`)
and 번복진트 쇼미더산 (`xOqbLdhvxlE`) already have matching approved embed
children stored as `region_blocked`. Neither is an absent projection. The
pending repair RPC correctly rejects existing non-live children rather than
overwriting them. Installing that repair would not restore either video.

The existing discovery CLI's local **audit-only** classifier now checks the
repair RPC's raw ID-or-canonical-URL collision predicate. Existing blocked,
dead, pending, inconsistent or production-linked children are not presented as
insert-ready projections. A separate valid published video stays usable even
when another source for the same meme is blocked; repair collision rules do
not replace the public filter's platform-aware playback identity rules.

Offline reclassification of the two scoped production records gives **zero
projection candidates and two replacement/revalidation targets**, with
`existing_publication_requires_revalidation` and `stored_content_region_blocked`.
Parent approved/limited eligibility is inherited from the preceding full audit,
not a new parent-moderation SELECT. No second full-catalog read was executed,
so the historical full bucket counts above must not be presented as a refreshed
result of the corrected classifier.

Aside's ordinary YouTube watch pages supplied stronger availability evidence:
the Netflix K-Content 나빌레라 trailer is country-restricted in this browser;
the 번복진트 clip is blocked following a CJ ENM ownership claim. The page
meanings match their video titles, but the actual video contents could not be
watched. Neither restriction is evidence that the video is private or deleted.
Both production detail pages correctly lack those playback embeds. 나빌레라
refers to the elderly ballet-learner webtoon/drama, not the same-name song.

The existing official Whiplash TikTok iframe `7433051983956888839` was also
activated: its cover disappeared, a real video frame and Pause control appeared,
and clicking Pause returned the control to Play. The leader inspected the
retained screenshot. Numeric playback time, continuous frame progression and
audio were not measured; no all-region or rights-clearance claim follows.

Evidence: `artifacts/release/20261014-media-recovery/scoped-projection-and-social-qa-20261014.json`.
The discovery/publication contract suites, Node syntax, scoped ESLint/diff checks
and four existing source-runtime suites (72/72) passed. Independent review
caught the mixed-source regression; it was corrected with regression tests,
and final independent re-review passed. These CLI changes are local and
unscheduled. No migration, canary, approval, upload or deployment was performed.
The remaining replacement and semantic-classification backlog, Instagram
runtime coverage and operator-channel review still prevent claiming full recovery.

## Semantic classification batch: 12 exact production records — 06:41 KST

A fresh read-only production SELECT at `2026-10-13T21:41:31.602756Z` examined
12 specific UUIDs from the prior classification-review backlog. All 12 remain
approved/limited image/text parents and have **zero content children and zero
source-ledger links**. This is not a sample estimate or a refreshed full-catalog
count. Stored descriptions and origin statements were treated as inherited,
unverified content, not instructions or verified popularity/date evidence.

Native analyst review yields the following local editorial proposals:

| Short ID | Item | Proposed next action |
| --- | --- | --- |
| `hvzqsfgk` | How You Like That challenge | Prioritize an exact choreography demonstration |
| `jjymq5z2` | Blinding Lights challenge | Prioritize the described arm/leg challenge, not merely the song MV |
| `tp8kw4m9` | Wednesday dance | Prioritize the original dance scene or a verified cover |
| `avm9cpmj` | BBoom BBoom challenge | Prioritize choreography; verify exact gestures before making claims |
| `77enkzjp` | NewJeans ETA challenge | Prioritize a same-track dance demonstration |
| `4ae4pkpa` | MSG Wannabe | Group/context entry; video is optional rather than a proven required missing video |
| `9ratsgay` | UCC boom | Broad cultural phenomenon; select a representative scope before linking one clip |
| `xrmn4vkk` | MapleStory boom | Game/cultural-history entry; do not automatically force a video |
| `8gbp6tmq` | Freechal communities | Internet-service history; contextual media optional |
| `xyem92ab` | PSY Napal Baji / New Face | Hold: two different songs conflated; operator identity choice needed |
| `bv8mem48` | Remember November 2026 | Hold: separate original image and later song-video variant |
| `6he5qhfx` | Kazuha Smart challenge | Hold for exact member/performance and provenance; generic MV is not equivalent |

Totals are **5 demonstration priorities, 4 contextual/optional entries and 3
identity holds**. This is an AI-assisted editorial proposal, not operator
approval or a persisted parent-classification change. No origin, dates or spread
claims in the inherited prose were endorsed by this review.

A bounded primary-source researcher found exact title/channel leads for
BLACKPINK's dance-performance video `32si5cfrCNc`, NewJeans ETA dance practice
`zzwWzLY7kEo`, and Netflix Wednesday scene `NakTu_VZxJ0`. Netflix's
[Tudum scene page](https://www.netflix.com/tudum/videos/wednesday-dance-scene-jenna-ortega-video)
provides additional programme context. These are proposed **usage examples**,
not independently verified origins or independent spread observations. Browser
watch-page checks are recorded separately; Data API metadata, official embed
availability, Korean-region settings and rights approval remain distinct gates.

PSY's separately titled official-channel leads
[`나팔바지 / tF27TNC_4pc`](https://www.youtube.com/watch?v=tF27TNC_4pc) and
[`New Face / OwJPPaEyqhI`](https://www.youtube.com/watch?v=OwJPPaEyqhI)
contradict treating those names as a single track. Do not attach both to the
same unchanged explanation. No suitable verified BBoom BBoom official uploader
or Blinding Lights participation source was established in this bounded pass;
the Naver TV exact-title lead is not an approved substitute provider.

The existing admin editor and `update_meme_with_safety_review` RPC edit category
but do **not** edit `media_type` (`components/admin/meme-edit-form.tsx`,
`lib/actions/admin.ts`, `20260812062242_radar_database_contract.sql`). The CLI's
`--editor-video-classified` remains a transient operator assertion, not a
persisted semantic approval. Do not report the local proposal as trusted human
review or silently change parent fields outside the existing workflow.

Artifacts: `classification-semantic-batch12-20261014.json` (production read) and
`classification-semantic-review12-20261014.json` (local proposal), under
`artifacts/release/20261014-media-recovery/`. Their fresh validation proves the
12 UUIDs, exact evidence phrases, 5/4/3 counts, valid candidate IDs and disabled
collection/publication boundaries. It does not prove playback or review approval.
The requested future budget is at most five concrete video IDs in **one** raw
`videos.list` request, with no search, derived analysis, platform combination or
automatic publication; it remains disabled pending explicit scoped approval.
No classification, source, rights, approval or public-content row was written.

## Local operator classification path added (not activated)

The editor gap noted above now has a local implementation behind
`ADMIN_MEDIA_CLASSIFICATION_ENABLED=false`: existing form → existing operator
action → backward-compatible `update_meme_with_safety_review` extension with
actual old/new media-type audit. It never approves a source or publishes a video.
The 12-row editorial proposal remains unapproved and production parents unchanged.
Fresh regressions passed 142/142, and an isolated real PostgreSQL fixture passed
25 assertions; this is not full local Supabase, production, or iframe-playback proof.
See `docs/operations/operator-media-classification-local-20261014.md` for files,
activation order, test boundaries and rollback. Recovered candidate watch-page
observations are saved separately and do not mark API/iframe/rights gates passed.
