# Detail reader UI — 2026-10-18

## Scope and design contract

The user requested readable, friendly meme details and production deployment.
Apply existing Next 16.3.4 / React 19 / Tailwind 4 components, not a new app,
font download, paid service or data pipeline. Keep existing URLs/canonical,
locales, public-media filtering, primary/reference separation, safety/lifecycle,
source facts, saved state and access controls. Do not enable the unshipped
produced-video lane or alter billing, approval or database policy.

Reader changes:

- Editorial answer hero: title, actual one-line meaning, clearly labelled
  lifecycle and usage signals, same save/share controls.
- Native section navigation to only existing sections, with 44px targets,
  keyboard focus and wrapping rather than a covering sticky overlay.
- Meaning/origin and citable sources initially expanded; native disclosure
  remains keyboard-operable. Keep usage examples separate from origin claims.
- Readable paragraph width/leading/wrapping; responsive media/information
  columns; maintain the reviewed performance-reference disclaimer.
- Localized labels and equivalent section access on four supported locales.

## Verification and release plan

Regression additions were run red before main implementation. Root targeted
integration now passes 56 tests in 8 files. These root tests are not deployment
proof: the working tree includes other unreleased features.

Release assembly pins the previous production frozen BUILD and selects only
reviewed UI changes and their closed component dependencies. Existing billing
controls and functional entrypoints stay in the production tree; unrelated root
removals are not approved by this UI task. Validation SOURCE and untouched BUILD
must remain separate. No dirty-root git commit/push or whole-root deployment.

## Frozen release evidence

Release `detail-ui-c45da68b9111` is assembled from the previous production
`secondary-reference-2d5d886433ea`, not the dirty repository root. The exact
14-file delta is recorded in
`artifacts/release/20261018-media-recovery/detail-ui-local-20261018-r6/delta-manifest.json`.
Its sole deployment input is `/private/tmp/memecatch-detail-ui-build.WPGuwz`;
the validation SOURCE is not a deployment input. The untouched BUILD contains
1,802 entries with fingerprint
`3ee8deef8fc29c67acd5af8f4e3629de88b25580991183d3f41d752682ba9d25`.

Fresh checks:

- Frozen relevant suite: 12 files, 94 tests passed.
- Release assembler: 5 tests passed; QA harness: 12 tests passed.
- Frozen TypeScript and scoped ESLint passed.
- Production build passed and generated 111 static pages. Existing unrelated
  metadataBase and home-recommendation warnings remain recorded.
- BUILD and prior production baseline fingerprints remained unchanged after
  validating/building SOURCE.
- Local Korean UI checks passed in all six cases. Full assertions pass for all
  three Saebbing sizes; Whiplash retains two failed provider-dependent assertions
  because the anonymous local server lacks private-ledger credentials and fails
  closed. This is not reported as a full local integration pass.
- Local English Chicken Jockey checks passed at mobile reduced-motion and
  desktop sizes. Console/runtime/unexpected first-party failures were zero.

Protected staging HTML checks passed on Saebbing, Whiplash and English Chicken
Jockey, including the approved reference disclaimer. Protected browser QA passed
6/6 Korean cases and 2/2 English cases. Direct visual inspection covered mobile
320px, desktop Whiplash and English story screenshots. The iframe documents
are deliberately blocked by the read-only QA, so grey blocked-iframe screenshots
are not playback evidence or a claim that the real player failed.

The same deployment, `dpl_3RHw5gV1g4rquG6SD6bEficzQP67`, was promoted at
`2026-10-18T11:46:40.838Z`. Fresh provider reads confirmed `catchmeme.com` resolves
to that exact project/deployment in READY state. No second build/deployment was
created for promotion.

Public browser verification completed:

- Korean: 6/6 passed, `detail-ui-production-after/run-DmYAoc/report.json`.
- English: 2/2 passed, `detail-ui-localized-production-after/run-TpAM9b/report.json`.
- All cases returned HTTP 200 with the exact expected release and canonical.
- Actual section links, initially-open meaning/origin, Enter close/reopen,
  accessible save/share and reduced-motion settings passed.
- Horizontal overflow, occluded hero/story, console errors, runtime exceptions
  and unexpected first-party network failures: zero.
- Whiplash retained its primary video and reviewed reference disclaimer;
  `PRHgGhd7nW8` VideoObject count remained zero.
- Direct production visual inspection covered mobile 390px hero and desktop
  Saebbing story; the stage also covered mobile 320px and English story.
- Intentionally blocked analytics/view writes and iframe documents are recorded
  separately, not concealed as real successful deliveries/playback.
- Existing Permissions-Policy origin-trial and iframe allowfullscreen warnings
  remain non-blocking and are recorded in the raw browser reports.
- All isolated QA browser processes completed; residual QA profiles: zero.

Report paths above are relative to
`artifacts/release/20261018-media-recovery/`.

The UI QA blocks non-read requests, known tracking and third-party iframe
documents. It proves layout/wiring, not new video playback. Source/API/approval
state is not changed. The prior exact two-ID raw-read authorization remains
unconsumed because the newer user task concerns UI; no videos.list call was
made as part of this task.

## Actual release files

Runtime files:

- `app/(default)/memes/[key]/page.tsx`
- `app/[locale]/memes/[key]/page.tsx`
- `components/answer-card.tsx`
- `components/meme-detail-navigation.tsx`
- `components/save-button.tsx`
- `components/source-evidence.tsx`

Tests in the same exact delta:

- `app/(default)/memes/[key]/page.test.ts`
- `app/(default)/memes/[key]/page.renewal.test.ts`
- `app/[locale]/memes/[key]/page.test.ts`
- `components/answer-card.test.tsx`
- `components/detail-ui-release.test.ts` (generated isolated-release boundary)
- `components/meme-detail-navigation.test.tsx`
- `components/save-button.test.tsx`
- `components/source-evidence.test.tsx`

Release assembly, guarded deployment/promotion, read-only browser harness and
reports live under `artifacts/release/20261018-media-recovery/`; they are local
verification tooling, not production runtime additions. The root still contains
unrelated user work and is intentionally not a byte-for-byte copy of this
selective production deployment.

## Configuration and side-effect boundary

No new environment variable, dependency, database migration, cron or external
API integration is required. The deployment retains the existing release
settings `RELEASE_SHA=detail-ui-c45da68b9111`,
`SOURCE_REFRESH_ENABLED=false`, `SOURCE_REVIEW_ATOMIC_ENABLED=true` as per-build
and runtime overrides; project-wide secrets/settings were not changed.
No database write, source approval, content overwrite, video upload, payment or
YouTube metadata call was made for this UI release. Existing canonical, locales,
Life signal, usage safety, primary/reference distinction and JSON-LD filtering
remain under their original contracts.

## Rollback

If a confirmed UI regression requires rollback, promote the prior exact READY
deployment `dpl_8W9JNiCjar2ZrRVEMmco4PYh2Cg8` in the existing project/scope. This
reverts the web build only; it does not revert or alter any database source
approval. Do not reset the dirty repository or redeploy its entire root.
