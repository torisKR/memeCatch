# Media recovery: Herdr branch lanes

Created from `main` (`26ff7783cb6e051418ef6246e9bfb484fef15d62`) on
2026-10-14 Asia/Seoul. The original dirty checkout remains intact.

| Lane | Local branch | Herdr workspace / pane | Read-only reviewer |
| --- | --- | --- | --- |
| Detail copy | `codex/media-detail-cleanup-20261014` | `w7` / `w7:p1` | `mc-detail-review` |
| Recovery ledger | `codex/media-recovery-ledger-20261014` | `w8` / `w8:p1` | `mc-recovery-review` |
| oEmbed safety | `codex/media-oembed-safety-20261014` | `w9` / `w9:p1` | `mc-oembed-review` |

Worktrees are under `.worktrees/` with the branch suffix as directory name.
Native implementation agents own their assigned files in these worktrees;
Herdr reviewers use read-only sandboxes. A reviewer does not own implementation.
No branches have been merged, committed, pushed, or deployed by this workflow.

## Resumed parallel verification — 05:32 KST

Reused the three existing branches rather than creating duplicate worktrees.
Added one no-focus shell pane to each existing Herdr workspace, leaving the
reviewer panes and their account-security dialogs untouched:

| Lane | Test pane | Fresh offline result |
| --- | --- | --- |
| Detail copy | `w7:p2` | 6 suites, 33 tests passed |
| Recovery ledger | `w8:p2` | 5 suites, 77 tests passed |
| oEmbed safety / URL intake | `w9:p2` | 20 tests passed |

All three runs were submitted concurrently through the discovered `default`
session and completed at their branch-specific shell prompts. The Vitest lanes
used the root's existing runner with `--configLoader runner --no-cache --pool
threads`; the social lane used Node's test runner. Fresh `git diff --check`
passed in each branch. No provider calls, production DB writes, deployments,
merges, commits, account-security dialog input, or sandbox/live Paddle changes
were performed in this resumed verification. These checks do not establish
production playback or corpus-wide recovery completion.

## Boundaries

- Copy only the lane's explicit source/test files and reviewed dependencies.
- Never copy environment files, signing keys, production credentials, outputs,
  or the whole dirty checkout into a worktree.
- Avoid `pnpm install` in these worktrees: the historical package configuration
  differs from the already installed root toolchain. Use the existing root
  binaries directly; do not change packages merely to run lane tests.
- No provider requests, production DB writes, automatic approvals, or uploads
  from implementation/review lanes.
- Keep source roles, rights review, public moderation gates, safe-use signals,
  Life signal, canonical URLs and official embeds intact.

## Local verification

Latest branch checks on 2026-10-14:

| Lane | Fresh focused tests | Other checks |
| --- | --- | --- |
| Detail copy | 10 files / 74 tests passed | Root TypeScript and diff checks passed; agent-reported ESLint passed |
| Recovery ledger | 5 files / 77 tests passed | Root TypeScript and diff checks passed; agent-reported ESLint passed |
| oEmbed safety / URL intake | 20 tests passed | Root TypeScript and diff checks passed; agent-reported ESLint passed |

At 05:08 KST, the root also reran the six detail component suites (33 tests)
and all three lane diff checks successfully. These are local checks, not
provider playback, production migration, or completed release evidence.

The oEmbed review found oversized-response buffering and loose video-ID matching.
Both are corrected in this branch with streaming cancellation and an exact
TikTok blockquote ID/canonical-cite pair. Fresh regression tests cover both;
the existing Herdr reviewer transcript still describes the earlier snapshot,
not a completed independent re-review of the final correction.

The recovery review identified scheduler starvation when stale and due limits
preceded eligibility filtering. The local correction now filters eligible due
rows before the limit and adds a service-role-only stale-candidate RPC that
excludes unresolved recoveries before its limit. An isolated PostgreSQL runtime
test selected the eligible candidate after 1,001 blocked rows and rolled back
its temporary setup. Neither migration installation nor corpus-wide recovery
has been verified in production. The fresh Herdr review found three additional
issues: RPC count options were ignored by the actual SDK, deferred social
recoveries could fill the supported queue, and a NULL SQL result could pass the
runtime assertion. These are corrected locally with RPC-level HEAD/exact-count
options, YouTube/Shorts filtering and stable ordering before the limit, and
`IS DISTINCT FROM`. Offline tests exercise the installed SDK transport without
network access. A subsequent independent Herdr review passed 56 targeted tests
and found no remaining blocker in its four-file scope, checked 05:13 KST.

## Isolated final7-r4 integration

- Source: `/private/tmp/memecatch-media-recovery-source.ETgy9i`.
- Release: `media-recovery-229461797be8`; 195 manifest entries, 55 scoped overlay
  files. Input paths, origins and SHA-256 values are in the release artifact's
  `input-provenance.json`; no whole worktree is copied.
- The final6 selective detail routes remain intact. The unrelated
  `production_id` marker is excluded by retaining final6 `lib/source-links.ts`.
- Fresh integration tests: 25 suites, 234 passed and one live canary skipped;
  separate social CLI tests: 20 passed. Local TypeScript and targeted ESLint
  passed. This is not a completed production build or release.
- Local QA server: `http://127.0.0.1:3016`, with public catalog credentials and
  the server-only ledger key forwarded through the existing project-bound
  resolver. A tested local fetch preload rejects every mutation method;
  provider keys are not forwarded and source refresh/review flags are disabled.
  The existing 3012 server was not stopped or replaced. Mobile/runtime QA is
  tracked separately. Generic env loading selected a stale key (one-row read
  HTTP 401); the existing bound resolver selected a valid one (HTTP 200).
- Final7-r3 runtime QA with the valid ledger connection passed 24 cases,
  zero console errors/runtime exceptions/control errors. The confirmed
  unlisted ID had zero anchor/iframe/JSON-LD/raw-document occurrences in all
  four viewports. This is not playback proof: 32 iframe documents were blocked.
  Screenshot inspection found the known changelog modal covering the page;
  the final7-r4 QA dismisses only that local modal in its disposable profile and
  fails on any remaining blocking dialog. Its result is recorded separately.
- Final7-r4 fresh QA: `final7-r4/local-detail-qa/run-gw9Pgd/report.json`, all
  24 cases passed on 320x568, 375x812, reduced-motion 390x844, and desktop.
  Console errors/runtime/control errors were zero; obsolete copy absent,
  safety/Life/canonical/locale checks passed, and the unlisted video ID stayed
  absent from anchors, iframes, JSON-LD and raw documents. Known changelog
  dismissal happened only in disposable browser storage. No playback was
  activated; 72 mutation requests and 32 iframe documents were blocked.
  All 195 source-manifest hashes were rechecked after QA with zero drift.
- New public-media read-failure behavior is covered by 16 tests: temporarily
  suppress playback while preserving citations and complete parent/child DTOs,
  including safety/lifecycle/canonical fields. No deletion/private assignment
  or database write occurs. Independent review passed the earlier 16 tests and
  offline guard test; the requested richer immutability assertions were then
  added and passed locally.
- Vercel upload dry-run: 1,792 inputs, zero forbidden paths. CLI account and
  team match the existing project. This was not a deployment or env mutation.
- Earlier failed `final7` and `final7-r1` assembly artifacts are retained for
  diagnosis; do not deploy them. No branch was merged or deployed.

The detail and oEmbed reviewer panes display an Advanced Account Security
setup prompt. This workflow did not dismiss it, choose an option, or alter
account security. Their earlier review results must not be represented as
independent reviews of later source changes.

From the detail-copy worktree:

```sh
node /Users/toris/projects/memecatch/node_modules/vitest/vitest.mjs run components/source-evidence.test.tsx components/source-provenance.test.tsx components/safety-rationale.test.tsx components/meme-market-passport.test.tsx components/trust-note.test.tsx components/doc-status-note.test.tsx
```

From the recovery-ledger worktree:

```sh
node /Users/toris/projects/memecatch/node_modules/vitest/vitest.mjs run lib/meme-delivery.test.ts lib/sources/recovery.server.test.ts lib/sources/refresh.server.test.ts lib/sources/youtube.server.test.ts supabase/source_refresh_eligibility_contract.test.ts
```

From the oEmbed-safety worktree:

```sh
node --test scripts/verify-oembed-sources.test.mjs scripts/import-source-candidates.test.mjs
```

Read live reviewer state with `herdr --session default agent get <name>` and
`herdr --session default agent read <name> --source recent-unwrapped --lines 100`.
A CLI observation timeout is not a stopped agent; inspect the same handle.

## Integration gates still required

### First staged cloud build

The approved web-only deployment was staged with `--prod --skip-domain` as
`dpl_AKDH2TXre6ZwriGNzBYyXR8FiwXQ` (final7-r4). It failed at the unchanged
baseline's pinned embedding-model preparation step with HTTP 429, before
Next.js compilation. Aside observed the Vercel failure page, not an app pass;
the placeholder returned HTTP 200. No domain promotion happened.

Deployment-only settings enabled the already installed operator-authenticated
atomic review path and kept automatic source refresh disabled. New eligibility/
projection-repair migrations and a further canary were not executed. A separate
bounded retry patch to the existing model preparer is being tested; the bundled
model version/checksums, search runtime and provider authentication stay intact.
The existing production server key is configured as sensitive and cannot be
retrieved through the env API; presence alone is not runtime read proof.

### Second staged cloud build: final7-r5

The bounded 429 retry correction passed 15 Node tests and an independent review.
The rebuilt release is `media-recovery-b454fc29a8fc`, with 197 manifest entries;
all prior 195 r4 entries are unchanged, and the two added inputs are only the
existing model-preparation script and its tests. The same staged deployment
`dpl_Agvr1Kx9UsuQtRmkcpVPwV2KwQoj` is now confirmed READY by the provider API.
The public alias still points to the original baseline; no promotion has occurred.

The exact completed CLI creation record confirms runtime/build overrides
`SOURCE_REFRESH_ENABLED=false` and `SOURCE_REVIEW_ATOMIC_ENABLED=true`, and
`--skip-domain`. Provider metadata confirms the deployment and override names,
but does not expose their values. This distinction is recorded in
`final7-r5/staged-deployment-result.json`; no project environment was changed.

Fresh independent input verification found zero missing or mismatched source
hashes, and confirmed the unrelated current Paddle review files/worktrees are
absent from this isolated build. Runtime-safety tests passed 63/63 and the model
tests passed 15/15. These are not cloud application or corpus recovery proof.

The anonymous staged browser run completed with 0/24 app cases passing because
all routes reached Vercel's login protection. Its screenshots and errors are
retained; a login page is not accepted as an app pass. Deployment protection was
not changed. The existing authenticated Aside session can render the staged app
and is collecting the required public-content checks separately. No promotion,
new migration, further canary, bulk refresh, new publication, or upload occurred.

- Review the final lane diffs and fresh tests before copying selected changes
  into a new isolated release. Do not deploy a branch or dirty tree wholesale.
- The completed one-source production provider check did not resolve its
  recovery record; preserve that failed canary report. A read-only filtered
  RPC returned the exact target successfully, but this is not a passed canary.
- Keep `SOURCE_REFRESH_ENABLED=false` until the actual production canary and
  operation budget are approved and verified; do not silently run another one.
- Instagram/TikTok oEmbed errors are not proof of deletion or privacy.
  Review or explicit authorized provider state is required to remove media.
- Instagram metadata use is subject to the official frontend-embedding-only
  restriction; no persistent enrichment from oEmbed in the recovery CLI.
- The operator's requested channel is `UCBSPgsi3DjJ0-EUEA-Spjug`. Its selected
  usage example remains pending, with no inferred rights clearance or public
  publication. The older produced-video OAuth channel is a separate feature.
- Missing media across the full eligible corpus and public runtime QA are
  still outstanding. Passing a lane's tests does not complete the full goal.

Rollback is non-destructive: do not merge/apply a lane, or revert only its
explicit integration patch. Preserve these branches/worktrees for inspection;
never reset the original checkout to roll back a lane.

## Production web promotion — 06:10–06:14 KST

The preceding no-promotion statements describe their earlier checkpoints. The
already approved **web-only** release has now been promoted, without rebuilding
or uploading the dirty root:

- Deployment: `dpl_Agvr1Kx9UsuQtRmkcpVPwV2KwQoj`.
- URL: `https://memecatch-49s6cfu8j-ironjustlikethatgmailcoms-projects.vercel.app`.
- Production: `https://catchmeme.com`.
- Provider alias read at `2026-10-13T21:10:46.082Z` points to that exact ID.
- Release: `media-recovery-b454fc29a8fc`; independent fresh verification matched
  all 197 source entries and all 57 provenance entries. The completed creation
  record resolves the previously reported refresh-flag evidence gap.
- Exact-r5 local QA: `final7-r5/local-detail-qa/run-09j5kU/report.json`, 24/24.
- First production QA: `production-detail-qa/run-uOIc6G/report.json`, 22/24.
  The two failures were Chrome `Fetch.continueRequest Invalid InterceptionId`
  control errors on English-route transitions, not app assertion or runtime
  errors. The report is retained unchanged.
- Unchanged-harness repeat: `production-detail-qa/run-Xqnw0A/report.json`,
  24/24 at `2026-10-13T21:13:50.001Z`. All 24 main documents returned 200,
  carried the exact release header and were inspected. Console/runtime/control
  errors were zero. All 56 mutation requests and 16 iframe document requests
  were blocked before transmission; **this does not prove video playback**.
- Safety/Life checks cover the 16 Korean detail/locale-target cases. The pending
  `PRHgGhd7nW8` and unavailable `YNOBV_uVzeY` checks cover their eight relevant
  viewport cases with zero anchor/iframe/JSON-LD/raw-document exposures.
- Root visually inspected actual reduced-motion mobile screenshots for Zico
  and Young MZ. The known changelog was dismissed only in disposable storage.

No new migration, canary rerun, bulk refresh, content approval, upload, project
env mutation, merge, commit or push occurred. Automatic source refresh remains
disabled by the recorded deployment-specific build/runtime override. Manual
review uses the already approved, installed atomic RPC; its missing-projection
correction is still not installed. Paddle files/worktrees remain excluded.

The full goal is **not complete**: missing-media restoration and operator
channel review remain. New eligibility/repair DB migrations and a rerun of the
previously failed exact canary still require scoped authority. Database reads
at 06:11 KST reconfirmed those new RPCs are absent.

Web rollback only: promote the known baseline `dpl_626e9JRnENohCMujGxyF2Nw7nuYo`
through the same linked project/scope, then verify its public release header.
Do not reset the checkout, reverse unrelated migrations or delete content.

## 2026-10-18 approved DB activation and successful existing-source canary

The earlier statements that eligibility/projection repair were not installed are
historical. After explicit new user approval, these two migrations were applied:

- `source_refresh_eligibility_20261018`, remote version `20261018100604`.
- `atomic_source_review_projection_repair_20261018`, remote version `20261018100614`.

Fresh reads verified the expected execution grants and an eligibility limit-1 read.
The preserved original review function body matched the tested local body; no
legacy source review was run or automatically approved by installing the wrapper.

The one additionally approved canary for existing source
`cbbfcba5-c980-4b49-b536-19b3a1057282` / `hYqE_mlPeHc` passed at
`2026-10-18T10:06:45.395Z`: exactly one `videos.list`, scoped metadata/availability
updates, one recovery resolution and one job audit. An independent read confirmed
the old `db_failure` recovery is resolved. Its existing live child count stayed one;
this is not restoration of a missing child or iframe playback proof. The previous
failure reports remain unchanged.

No bulk refresh, new approval, upload, new web deployment or produced-video view
migration occurred. Automatic refresh was not enabled. The requested channel's
`PRHgGhd7nW8` is still pending/unknown-rights. The exact read-only published,
non-phrase `doc_class=meme, media_type=video` cohort is 1,195 documents with 20
missing approved/live video-or-embed children; it is not compared as a delta to
the earlier broader cohort.

See `media-recovery-targeted-intake-20261018.md` and
`artifacts/release/20261018-media-recovery/approved-db-activation-and-canary.json`
for current scope, proof limits, local exact-target intake changes, resolved
historical copy-test conflict, migration-history mapping and rollback guidance.
The final related selection passed 22 files / 267 tests with one deliberately
disabled live-canary test skipped; the separately approved live canary passed once.
