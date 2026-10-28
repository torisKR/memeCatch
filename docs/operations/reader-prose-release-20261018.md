# Reader-prose release and candidate semantic review — 2026-10-18

## Goal and boundaries

Continue the full production media-recovery goal; do not treat copy cleanup as
completion of missing-media restoration. The previous turn made progress by
deploying exact-target admin intake and retrieving five approved raw metadata
items once. That Data API authorization is consumed and was not reused here.

This web lane removes the two known internal illustration-operation suffixes
from public reader projection without overwriting DB descriptions. It aligns
WebPage.description with that same visible full prose. Genuine AI-meme content,
DefinedTerm summary, canonical/locales, sources, usage safety, Life signal and
all pre-existing video eligibility gates are retained.

No DB migration, source approval, upload, broad refresh, new provider API call or
unreviewed automatic publication belongs to this copy release. The separate
produced-video public-only migration remains outside scope and unapplied here.

## Exact release input

- Current production baseline verified at `2026-10-18T10:33:46.237Z`:
  `dpl_3ZFfCzNSsTEBQqcmPFdZzaD9T2Fa`, READY.
- Baseline local freeze: `/private/tmp/memecatch-targeted-intake-build.3nA3zE`,
  1,797 releasable entries, fingerprint
  `c4c3eb4e76477715c2b0d5665d324673052a3e98647cf940a12408af0f083790`.
- Sole final deployment input:
  `/private/tmp/memecatch-reader-prose-build.fLP1VQ` (r3).
- Release: `reader-prose-541e6767b7f1`.
- Seven-path delta; 1,798 releasable entries, fingerprint
  `fa957988d36cb3e1a951a5cc3c7557aece346e37f31456871d37d4cfb94d9e91`.
- r2 validation source `/private/tmp/memecatch-reader-prose-source.Wrqr8L`
  passed the local Next production build. Its generated next-env.d.ts/sw.js/.next
  are validation artifacts, never deployment input. Its pre-build seven-path
  content matches r3, which remains untouched.
- Existing baseline public/sw.js is intentionally preserved in deploy input;
  its presence is not contamination. Distinct inodes were verified.

Runtime changes are only lib/meme-public-detail.ts, the two locale detail-page
wiring hunks and MemeWebPageJsonLd's two-line description change. The other
three delta paths are focused tests. Dirty-root produced-video, classification,
Paddle, homepage and unrelated schema/page edits are not copied.

Evidence: `artifacts/release/20261018-media-recovery/reader-prose-local-20261018-r3/`.

Exact seven changed deployment paths:

1. `lib/meme-public-detail.ts`
2. `lib/meme-public-detail.test.ts`
3. `app/(default)/memes/[key]/page.tsx` (selective wiring only)
4. `app/(default)/memes/[key]/page.test.ts` (one contract expectation)
5. `app/[locale]/memes/[key]/page.tsx` (selective wiring only)
6. `components/json-ld.tsx` (WebPage description only)
7. `components/reader-prose-release.test.tsx`

Data flow: stored description → exact known terminal-note filter → visible
reader prose and matching WebPage.description. Stored originals/admin review
data remain unchanged. The concise summary still feeds DefinedTerm. This adds
no environment variables, scheduler, provider call, queue or ongoing API cost.
QA/assembler scripts, reports and operation notes are local evidence, not extra
application paths copied into this deployment.

## Verification

- Isolated focused regression: 5 files / 49 passed.
- Isolated TypeScript and scoped ESLint: passed.
- Assembler and final browser-assertion tests: 19 passed (5 + 14).
- Local production build: exit 0; baseline metadataBase and recommendation-query
  fallback warnings remain. This does not prove external embedding-model runtime.
- Read-only local server: `http://127.0.0.1:3018` on the r2 validation source,
  with all non-read fetches blocked by a preload and no provider keys passed.
- Two-document browser verification compares actual displayed prose to
  parsed WebPage JSON-LD, and one-line summary to DefinedTerm, across mobile,
  reduced motion and desktop. The corrected local run passed 6/6:
  `reader-prose-local-browser-corrected/run-yElooN/report.json`.
- The same current-production baseline run failed 6/6 for exactly the intended
  two defects: exposed internal suffix and WebPage/full-prose mismatch. Other
  assertions and app console/runtime/control checks passed. This red baseline
  is preserved at `reader-prose-production-before-corrected/run-L9Umqf/report.json`.
- Existing local detail/locale/media regression passed 24/24:
  `reader-prose-local-media-regression/run-WJYRq4/report.json`.
- The initial reader QA assumed the dirty-root h2/details layout rather than
  deployed h3/section. Those two task-owned runs were diagnostically stopped,
  not counted as passes or product failures. The shared DOM selector was fixed
  and tested against both layouts before the corrected red/green runs above.
  Evidence: `reader-prose-qa-layout-diagnostic.json`.
- A final QA-only enhancement scrolls the actual prose paragraph into viewport
  and proves its positive-size rect intersects the viewport before screenshot.
  It does not change product code or weaken preceding AnswerCard assertions.
  That final local visual run also passed 6/6:
  `reader-prose-local-visual-proof/run-eqB4yK/report.json`.
- Independent release review: APPROVE, zero scoped findings after explicit
  source/build roles and fresh post-build integrity evidence were added.
- Vercel upload dry-run: 1,795 files, zero forbidden secret/runtime paths.

## Cloud staging and production promotion

The existing project received one `--prod --skip-domain` deployment:
`dpl_6enrRQBkNhF3y5sRwwdiuqkta9e3`,
`https://memecatch-n41cswqvx-ironjustlikethatgmailcoms-projects.vercel.app`.
At `2026-10-18T10:43:54.301Z` its provider state was BUILDING, then READY at
`2026-10-18T10:46:32.464Z`. The creation CLI
returned multi-line JSON that the first summary did not parse; the existing ID
was located through a read-only project listing, not recreated.

Three protected staging route/prose/schema checks passed. Production still
matched the targeted-intake baseline at `10:47:12.838Z`, before promotion.
The one existing READY deployment was promoted once. Production returned HTTP
200 with `reader-prose-541e6767b7f1` at `10:47:48.267Z`. A read-only provider
lookup at `10:50:47.201Z` confirmed `catchmeme.com` resolves to that exact READY
deployment in the intended project.

Runtime/build overrides preserve refresh disabled and atomic review enabled.
No project-level secret/environment setting was changed. The existing protection
bypass was used in memory only for staging; protection and credentials were not
changed or exposed.
Evidence: `reader-prose-local-20261018-r3/staged-deployment.json`.

## Production browser and Google validation

The final visible-prose screenshot run passed **6/6**, including 320px mobile,
390px reduced-motion and desktop:
`reader-prose-production-after/run-jaUAbl/report.json` (10:48:18.634Z).
Actual full prose equals WebPage.description; DefinedTerm equals the summary.
All six have zero app console exceptions/errors, runtime exceptions,
first-party network failures or browser-control errors. Safety, Life signal,
canonical and real AI-meme explanations remain. These two pages emit no
VideoObject and expose no pending Scene Pocket video.

The first existing-detail/locale production run passed 22/24. The two failures
were CDP `Fetch.continueRequest` / `Invalid InterceptionId` on canceled prefetched
navigation requests, not failing page assertions. Keep this raw result:
`reader-prose-production-media-regression/run-o3AerG/report.json`.
A single identical read-only recheck passed **24/24** at `10:51:47.342Z`:
`reader-prose-production-media-regression-recheck/run-xofNfz/report.json`.
It had zero app console errors, runtime exceptions, network failures, browser
control errors or same-origin oEmbed requests. Combined with the prose run,
the final production matrix passed 30/30. Do not overwrite or reclassify the
initial run as passing. All 24 inspected regression snapshots emitted zero
VideoObjects, so this demonstrates no false-positive exposure on these cases,
not the positive eligibility path of a verified video.

Aside ran Google's actual Rich Results Test once per URL:

- Ballerina Cappuccina: crawled **2026-10-18 19:48:40 Asia/Seoul**,
  [result](https://search.google.com/test/rich-results/result?id=fZuSPTwmFl-IfYqlMjogLg).
- Tralalero Tralala: crawled **2026-10-18 19:49:57 Asia/Seoul**,
  [result](https://search.google.com/test/rich-results/result?id=aCh_rrF6HwzqU8yC_QNUEw).

Both showed two valid items (BreadcrumbList and Organization), successful page
fetch, crawling/indexing allowed, and no displayed errors or warnings. This is
not proof of indexing, search appearance, VideoObject eligibility or playback.
WebPage/DefinedTerm prose parity is proven by the separate DOM/JSON-LD checks,
not by claiming those are Google rich-result types. No Search Console indexing
request, account change or review submission was performed.

All browser regression runs blocked non-read requests, trackers and iframe
documents before transmission. Intentional blocked-resource errors and existing
Permissions-Policy/iframe warnings remain in raw browser logs; do not describe
those logs as empty or these tests as playback verification.

## Candidate review did not grant publication

`candidate-semantic-browser-review.json` records the bounded Aside observation.
The IU MV's song identity is supported, but audio was not heard and the exact
three-high-note context remains on hold. The Scene Pocket video contains real
stage dance imagery and is suitable for a proposed performance reference, not
challenge-origin or independent-spread evidence. Public descriptions did not
establish download/edit/reupload permission. Only official linking/embedding is
under consideration; no downloading or republication was performed.

Human authorization for the single Scene Pocket pending source's metadata
update/review/public reference link was requested separately. Browser viewing
does not itself approve that transition. Do not apply it without an actual reply.

## Rollback and remaining work

If this exact web release needs rollback, restore the prior
verified targeted-intake deployment ID above. Do not undo additive DB migrations,
restore stale media availability or delete source/history rows. Local changes
are reversible by the seven-path selective delta; preserve unrelated root work.

The 20 missing video parents, separate image/text classification backlog and
Instagram/TikTok exact-source review remain part of the full goal. Copy cleanup,
a browser frame or an API embed flag is not evidence that those are restored.
