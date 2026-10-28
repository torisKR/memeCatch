# Media recovery: exact intake and verified candidate leads — 2026-10-18

## Scope

The previous goal turn made concrete progress: two authorized production
migrations and one guarded existing-source canary completed. That canary slot
was consumed; it was not rerun here. The whole media-restoration goal remains
incomplete. This continuation separates stored source state, raw provider
metadata, measured anonymous playback, operator review and publication.

No source was approved, no video was uploaded, and no bulk refresh or automatic
publication was enabled in this continuation. A separately authorized web-only
deployment was staged without domain promotion first, then promoted after the
READY state, exact-release route checks and unchanged-baseline check passed.

## Current missing-media worklist

The read-only production query at `2026-10-18T10:13:12.217269Z` selected the exact
published, approved/limited, non-phrase, `doc_class=meme, media_type=video` cohort.
Twenty parents have no approved live video/embed child. The per-source state
is stored historical metadata, not a fresh provider observation.

| Stored condition | Parents |
| --- | ---: |
| No source | 1 |
| Removed source | 3 |
| Existing region-blocked child | 3 |
| Unlisted and unembeddable source | 3 |
| Public but unembeddable source | 10 |

All 19 known source UUID/video-ID pairs were reconciled. In particular,
Navillera and the Verbal Jint reversal have existing region-blocked children;
they are not missing projections that can simply be inserted. Full row evidence:

- `artifacts/release/20261018-media-recovery/missing20-live-stored-state.json`
- `artifacts/release/20261018-media-recovery/missing20-recovery-matrix.json`
- `docs/operations/missing20-recovery-matrix-20261018.md`

The separate text/image classification backlog still needs semantic review; this
20-row cohort is not the boundary of the full user goal.

## Exactly one approved raw YouTube request

The user explicitly permitted one `videos.list` request for five exact IDs, with
no DB change, approval, upload or automatic publication. At
`2026-10-18T10:17:08.310Z`, that one request succeeded and returned all five IDs.
Only `snippet`, `status` and `contentDetails` fields were requested; statistics,
search, pagination and retry were absent.

| Video | Raw observation | Consequence for this step |
| --- | --- | --- |
| `gFT1mEtk3VA` | Public, embeddable, KR in blocked regions | Existing restriction remains; not a restoration candidate for Korea. |
| `BbMwihl693s` | Public, not embeddable | Do not restore its iframe. |
| `lEsn-xANds0` | Public, not embeddable | Do not restore its iframe. |
| `jeqdYqsrsA0` | Public, embeddable; title *IU (아이유) _ Good Day (좋은 날) _ MV*; 1theK | Candidate lead only, not an approved source. |
| `PRHgGhd7nW8` | Public, embeddable; channel ID exactly `UCBSPgsi3DjJ0-EUEA-Spjug` | Matches the requested 씬포켓 channel; existing candidate remains pending/unknown-rights. |

The script's fixed execution directory prevents reuse of the consumed slot.
Do not delete/reset it or rerun the real command without new authority.
Existing environment names are reused: `YOUTUBE_API_KEY` and the project-bound
Supabase environment resolver. Values are never printed or hard-coded.

Evidence and retention:

- `artifacts/release/20261018-media-recovery/read-approved-youtube-metadata.mjs`
- `artifacts/release/20261018-media-recovery/read-approved-youtube-metadata.test.mjs`
- `artifacts/release/20261018-media-recovery/youtube-five-approved-once/attempt.json`
- `artifacts/release/20261018-media-recovery/youtube-five-approved-once/result.json`
- Raw fields must be refreshed or deleted by **2026-11-17T10:17:08.310Z**.
  The artifact records this deadline; no new retention scheduler was activated.

Current official reference confirms the selected fields and method. Missing IDs
would not distinguish private versus deleted state. `embeddable=true` alone is
not actual playback proof. See the [videos.list reference](https://developers.google.com/youtube/data/reference/rest/v3/videos/list),
[video resource](https://developers.google.com/youtube/data/reference/rest/v3/videos),
and [developer policies](https://developers.google.com/youtube/terms/developer-policies).
The documented method cost is one unit; this is not an account remaining-quota
measurement.

## Separate anonymous playback observations

The existing `runAnonymousPlayerProbe` was reused with disposable Chrome
profiles, without user cookies, downloads or additional Data API requests.
Both exact candidate IDs reported player-ready, PLAYING and numeric time
progression greater than 0.5 seconds:

- `jeqdYqsrsA0`: 0.089733 → 0.690389 seconds, at `10:17:49.826Z`.
- `PRHgGhd7nW8`: 0.099584 → 0.698646 seconds, at `10:17:53.272Z`.

Evidence: `artifacts/release/20261018-media-recovery/candidate-anonymous-playback.json`.
Only the beginning was measured. This is not whole-video semantic/audio review,
independent host geolocation, universal Korean playback, or rights approval.
No stored availability or review state was changed from this probe.

## Isolated admin-intake web release

The frozen production baseline was independently confirmed through the existing
Vercel CLI: `catchmeme.com` still resolved to deployment
`dpl_Agvr1Kx9UsuQtRmkcpVPwV2KwQoj` before staging.
MCP access returned 403, but the same team's CLI credentials worked; no account,
team, project, authentication or domain settings were changed to work around it.

The local assembler pins the deployed baseline's 197 manifest entries and its
whole-tree fingerprint. It copies only eight reviewed admin/auth files and
inserts one source-intake link into the frozen admin edit page. It does not copy
the dirty root page or unrelated classification, homepage, Paddle or produced-video
work. The resulting release is `targeted-intake-c66ed4a2aac1`.

- Sole deployment input: `/private/tmp/memecatch-targeted-intake-build.3nA3zE`.
- Validation-only source: `/private/tmp/memecatch-targeted-intake-source.bpHu05`.
- The source-side local build changed `next-env.d.ts` and `public/sw.js`, in
  addition to `.next`; it is deliberately **not** a deployment input.
- Independent post-build full-tree comparison confirms the untouched build input
  still differs by exactly nine allowlisted paths. Its whole-tree fingerprint is
  `c4c3eb4e76477715c2b0d5665d324673052a3e98647cf940a12408af0f083790`.
- Upload dry-run: 1,794 files, zero forbidden paths. Secrets, local MCP, artifacts,
  local model/cache/runtime directories and node_modules are not uploaded.

Verification evidence lives under
`artifacts/release/20261018-media-recovery/targeted-intake-local-20261018-r1/`:

- Assembler regression: **5 passed**.
- Isolated admin/auth tests: **5 files, 119 passed**.
- Isolated TypeScript and scoped ESLint: passed.
- Production-mode local Next build: exit 0. Baseline `metadataBase` and
  home-editorial fallback warnings were retained; this is not an embedding-model
  runtime test.
- Disposable local browser: **24/24 passed**, covering 320/375 mobile, 390 reduced
  motion, desktop, Korean/English routes and locale switching. Console/runtime
  error arrays are empty. Browser-level logs contain intentional mutation/iframe
  blocks plus an existing Permissions-Policy warning, not an all-empty log claim.
- 56 mutation requests and 16 iframe documents were intentionally blocked by the
  regression harness; the separate candidate playback test above did allow the
  official player.
- Independent review approved the exact build after the generated-source drift
  was explicitly documented and the handoff fixed.

Staged deployment:

- ID: `dpl_3ZFfCzNSsTEBQqcmPFdZzaD9T2Fa`.
- URL: `https://memecatch-lyf2qp7to-ironjustlikethatgmailcoms-projects.vercel.app`.
- Created with `--prod --skip-domain --no-wait`.
- Runtime/build overrides preserve `SOURCE_REFRESH_ENABLED=false` and
  `SOURCE_REVIEW_ATOMIC_ENABLED=true`, with the new release label.
- Provider state became **READY** at `2026-10-18T10:27:25.313Z`.
- Protected staging GET checks passed for exact new release, Korean headings,
  and suppression of pending/removed embeds on three representative details.
  Anonymous admin access returned 307 and preserved the exact meme ID in `next`.
  Only the already configured automation access was used in memory; deployment
  protection and bypass credentials were not changed.
- The pre-promotion check at `10:28:23.933Z` still matched the old production
  baseline. The same staged ID was then promoted once, without rebuilding.
- At `10:29:00.141Z`, `catchmeme.com` resolved to the new READY deployment. Its
  anonymous admin response also carried `targeted-intake-c66ed4a2aac1` and the
  expected safe login redirect. No authenticated operator submission was made.
- First production disposable-browser run: **23/24 passed**. The single failure
  was a `Fetch.continueRequest` CDP `Invalid InterceptionId` for the previous
  page's `/en/explore` prefetch during the 320px locale switch. Its rendered KO
  route, heading, canonical, controls, safety, Life signal and release checks
  passed, and app console/runtime plus first-party failure arrays were empty.
  This is a harness-control failure, not silently counted as a passing run.
  Original evidence is preserved at
  `targeted-intake-production-qa/run-obh3wC/report.json`.
- A single unchanged full-matrix confirmation passed **24/24**, preserving both
  the first failed observation and all request-blocking safeguards. Report:
  `targeted-intake-production-qa-confirmation/run-9YDp6s/report.json`.
  All snapshots carried `targeted-intake-c66ed4a2aac1`. Console/runtime,
  first-party failures and browser-control errors were zero. The browser logs
  still include intentional request blocks and the baseline Permissions-Policy
  warning; this is not a claim that all browser logs were empty. The harness
  blocked 56 mutation requests, 28 tracker requests and 16 iframe documents.
  Actual official-player playback is evidenced only by the separate two-candidate
  anonymous probe, not by this regression suite.
- Evidence: `targeted-intake-local-20261018-r1/staged-deployment.json`.

## Reader prose: separate local-only correction

A read-only published-text scan found 13 broad keyword matches, mostly legitimate
AI-meme descriptions (and a substring match in 스크롤링). Those were not removed
as if they were internal generation notes. Two descriptions did contain exact
internal illustration-operation suffixes:

- `djjz3enf`: `특정 파생 작품의 구도를 복제하지 않는 편집 삽화로 대표한다.`
- `py3fd5gq`: `이 항목의 대표 이미지는 특정 원본을 복제하지 않은 편집 일러스트로 운영한다.`

`publicReaderDescription` removes only these exact trailing sentences in public
reader projection. DB/admin originals, real AI subject matter, safety, rights,
quotes inside text, source links and Life signal remain intact. Korean/localized
visible descriptions and WebPage JSON-LD use the same value. The JSON-LD
component previously ignored the supplied full description and emitted only
the summary; it now uses the cleaned full description with a blank-only summary
fallback. DefinedTerm intentionally retains its concise summary. This eight-file local
lane is not included in the nine-file staged release.

Local regression: **4 files, 69 passed**; typecheck, targeted lint and whitespace
checks passed. Independent re-review: **APPROVE, zero findings**. The combined
admin/auth, reader/schema, public-media and refresh regression run passed
**15 files, 295 tests, with one intentional live-canary skip**. No new canary was
authorized or executed by that test run.

## Rollback and remaining gates

Promotion prerequisites were satisfied: READY provider state, matching release
and exact route checks, and an unchanged production baseline. Deployment
protection was not weakened and no new bypass secret was created.

If a promoted admin release needs rollback, restore the previous verified web
deployment; do not undo the two approved additive DB migrations, restore stale
source metadata, reopen the resolved canary, or delete live source/content rows.
Local reader cleanup can be reversed by only its small helper/wiring hunks,
preserving unrelated dirty work.

Still needed: exact replacement/semantic/rights review for missing media,
explicit operator approval before public projection, manual classification of
the separate image/text backlog, and suitable authorized Instagram/TikTok URLs.
The approved five-ID raw-read slot and previous canary slot are both consumed.

## Subsequent reader-prose production release

The local-only reader lane described above was subsequently narrowed into an
independently reviewed seven-file isolated release, not copied wholesale from
the dirty tree. `reader-prose-541e6767b7f1` was promoted as
`dpl_6enrRQBkNhF3y5sRwwdiuqkta9e3`. See
`docs/operations/reader-prose-release-20261018.md` for exact input integrity,
production browser results and actual Google Rich Results Test evidence.
This does not restore the 20 missing-video parents or grant source approval.
