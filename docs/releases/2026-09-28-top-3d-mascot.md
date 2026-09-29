# Top-of-home 3D mascot — 2026-09-28

## Delivered

Original checkout: `/Users/toris/projects/memecatch`, current `main`, existing uncommitted work retained. No commit, push, deployment, database mutation, advertising/account change, or dependency installation in this pass.

- Shared Korean, English, Japanese, Simplified Chinese and Traditional Chinese home now begins with one full-width artwork banner before its h1 and search form.
- Banner heights are 224px mobile, 288px tablet, 320px at lg and 384px at xl. Search and content remain server-rendered below it.
- Original Three.js geometry depicts a beveled orange speech mascot with cream/ink eyes, modeled pupils and glints, smile, cheeks and feet, cream meme cards behind it, an orbit and four distinct context tokens. This is live WebGL geometry, not a raster picture presented as 3D.
- A matching original SVG fallback is retained for unsupported devices and errors. Accessible scene descriptions are supplied in all five languages.
- Camera framing uses the actual geometry bounds plus 12% room; an enclosing-sphere implementation initially made the character too small, as confirmed in a real screenshot. Updated tests require more than 75% occupancy of the limiting viewport dimension and no clipping. Orbit and token tilts are bounded rather than rotating indefinitely outside the framing envelope.
- An existing automatic changelog modal was observed covering the artwork in a fresh browser. On home routes only, it no longer opens or locks scrolling; it does not mark the notice read, and other pages retain the notice workflow.
- Existing lazy import, DPR cap 1.5, pause/resume, reduced motion, off-screen suspension, resource disposal and context-loss recovery remain in place.

## Source changes

- `components/home/home-experience.tsx`
- `components/home/home-experience.test.tsx`
- `components/home/home-scene-renderer.ts`
- `components/home/home-scene-renderer.test.ts`
- `components/home/home-scene-fallback.tsx`
- `lib/home-copy.ts`
- `components/changelog-modal.tsx`
- `components/changelog-modal.test.tsx`

## Fresh verification

Node 24.16.0:

- Full Vitest: **348 files / 2,483 tests passed**, with `--maxWorkers=4 --testTimeout=30000`.
- Initial focused home/scene/modal/copy suite: **7 files / 40 tests passed**; the final full run above includes one additional passing modal-navigation regression.
- TypeScript and scoped ESLint passed.
- Production-mode local build passed, 96 static pages. Three pre-existing special-route metadataBase warnings remain. The loopback build is a QA artifact and must be rebuilt with deployment settings before publishing.
- The existing `scripts/qa-unified-home.mjs` passed across all 15 combinations of five languages and 375/768/1440px widths; no JS exceptions, broken images, horizontal overflow, or advertising runtime were recorded.
- Actual GPU draw instrumentation verified animation, pause, resume, reduced-motion stop, off-screen stop/resume. Forced context loss restored the SVG. No-WebGL, Save-Data and deviceMemory=2 used SVG with zero draws. All four signal disclosures operated by Enter.
- Additional direct browser geometry assertions passed for all 15 route/width combinations: stage inside first viewport, above heading and search, horizontally contained, no modal.
- Observed at 375px: stage x=16, y=125, width=343, height=224, bottom=349; h1 begins at y=401.
- Observed at 1440px: stage x=160, y=89, width=1120, height=384, bottom=473; h1 begins at y=533.
- Native image inspection of final desktop and mobile screenshots confirmed the enlarged mascot, four tokens, unobscured banner and compact search.
- Axe audit scoped to the mobile hero: 0 violations, 1 incomplete color-contrast rule because of the gradient background. This is not a complete WCAG certification or real-device benchmark.

A separate read-only reviewer found a stale modal-state issue on non-home → home → non-home navigation. A new failing regression reproduced it; route-keyed modal state now resets the timer and scroll lock without changing persisted notice preferences. Final full tests, build and the extended browser suite were rerun successfully after that fix. No other important scoped defect was reported; the reviewer also sampled unclipped geometry through animated states at widths 320–1152px.

The attempted edit to extend the existing QA script was security-blocked and was not applied or bypassed. The existing script plus normal read-only browser geometry assertions supplied verification instead. An initial screenshot read outside allowed roots was denied; subsequent new screenshots were captured in the permitted project QA directory and read normally.

## Evidence

Full browser run, report and state screenshots:
`/var/folders/1k/hsqljbyj4c9_ky4dsfh26k1r0000gn/T/memecatch-home-qa-2QEVaD/`

Final native-inspected captures under the project:
- Desktop: `.local/original-qa-20260928/screenshot-1790600215567.jpg`
- Mobile: `.local/original-qa-20260928/screenshot-1790600216163.jpg`
- English dark/reduced-motion: `.local/original-qa-20260928/screenshot-1790600413978.jpg`

## Running local preview

- `http://127.0.0.1:3105/?lang=ko`
- `http://127.0.0.1:3105/en`
- `/ja`, `/zh`, `/zh-tw` share the same artwork and hierarchy.
- Current launched PID: 43771. Log: `/tmp/memecatch-top3d-preview-20260928.log`.
- Bound to loopback only, intended to remain running for the user's Mac browser. Verify process identity before stopping; PID numbers may be reused.
- Uses `.local/design-preview-runtime-20260928.mjs` and the existing read-only remote-fetch guard. No real ads or production write workflows should be exercised in this design preview.
- The public catchmeme.com deployment has not been updated in this task.
