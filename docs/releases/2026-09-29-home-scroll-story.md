# Homepage scroll-driven 3D and shared locale UX

Date: 2026-09-29. Workspace: /Users/toris/projects/memecatch, existing main checkout.

## Delivered

The shared HomeExperience now marks the hero track/pin, and its HomeScene defaults to a third Scroll control. Native document scrolling continuously drives the physical Three.js stack-to-spread positions and bounded root rotation; scrolling back reverses the pose. Pointer and signal interactions remain separate from editorial safety data.

All ko/en/ja/zh/zh-tw home routes use the same HomeExperience/HomeScene, CSS breakpoints, scroll binding and renderer. Copy and genuinely available localized records may differ. No locale-specific motion logic was introduced.

On desktop viewports at least 1280px wide and 896px high, a progressively enabled sticky hero provides half a viewport of native scroll travel. It is enabled only around real WebGL initialization and removed on failure/disposal. Mobile and shorter viewports stay in natural flow; progress is based on the stage passing through the viewport, not the whole document length. Reduced motion disables the sticky extension. No wheel/touch prevention, scroll snapping, scroll lock or extra dependencies were added.

The localized Gather / Unfold / Explore cue shows the scroll target without React state updates on every pixel. Native Scroll / Stack / Spread radio controls allow manual override. Pause freezes scroll updates and GPU draws. Resume refreshes current geometry. The binding is initialized before the first render to support restored scroll positions, and its events/ResizeObserver/pending RAF/attributes are cleaned up.

## Focused review fixes

- Terminal static/failed hero states no longer incorrectly show endless Loading 3D in the scroll cue; they use the existing localized unavailable copy.
- Paused scroll -> Stack now reapplies the actual stacked geometry even if the renderer remembers Stack as its earlier manual mode. Merely receiving scroll target updates still does not draw while paused.

## Source files

- components/home/home-scroll-binding.ts and .test.ts: geometry / native scroll lifecycle.
- components/home/home-scene-renderer.ts and .test.ts: continuous scroll controller, physical layout/rotation, first draw and lifecycle.
- components/home/home-scene.tsx and .test.tsx: binding, controls, pause/manual/fallback handling and cue.
- components/home/home-scroll-story.module.css: concise progress cue.
- components/home/home-experience.tsx and .test.tsx: shared track/pin markup in every locale.
- components/home/home-web3.module.css: native sticky enhancement with mobile/reduced-motion fallback.
- lib/home-scene-copy.ts: five-language scroll instructions.
- scripts/qa-home-scroll-story.mjs: dedicated native-browser scroll regressions.
- scripts/qa-unified-home.mjs: dedicated scroll-run branch and JPEG screenshot option.
- scripts/qa-home-interactions.mjs: explicitly choose Stack before manual-pointer regressions, so automatic scroll ownership cannot be mistaken for pointer movement.

## Verification evidence

1. Whole Vitest suite: **355 files / 2,561 tests passed**, maxWorkers=4, testTimeout=30000. All product tests retained. New scroll tests include real Three.js object positions, reverse interpolation, camera bounds, picking, invalid inputs, pause and cleanup.
2. TypeScript --noEmit passed.
3. Scoped ESLint passed. git diff --check and Node syntax checks for QA scripts passed.
4. Dedicated scroll browser suite: **28 checks passed**, 5 locales x desktop 1440x1000 and mobile 375x812. Every route used one canvas, three motion-mode controls and the same five home sections. Intermediate rendered progress was about 0.495 at a requested 0.5 in every locale, and about 0.846 at a requested 0.85; returning upward reversed both layout and root yaw.
5. Full existing browser regression: **15 locale/viewport combinations (375/768/1440)** plus **32 interaction checks** (12 original 3D, 9 landing/discovery, 11 interaction polish) passed. This included actual language-selector navigation, stale locale cookie, touch scrolling, pointer dragging, WebGL context loss, data-saving/low-memory/no-WebGL fallback, keyboard selection, filters and chapter links.
6. Both final browser reports recorded **zero JavaScript exceptions**. Checks found no broken images, horizontal overflow or live AdSense script. Dedicated paused-scroll test observed no additional GPU draws.
7. JPEG screenshots of desktop midpoint/endpoint and mobile midpoint were visually inspected. Initial attempts to read larger PNG screenshots through DevSpace timed out, so compressed JPEG capture was added; this does not alter the app.

Dedicated final report and seven screenshots:
.local/memecatch-home-qa-5xewg8/scroll-report.json
.local/memecatch-home-qa-5xewg8/scroll-1440-start.jpg
.local/memecatch-home-qa-5xewg8/scroll-1440-middle.jpg
.local/memecatch-home-qa-5xewg8/scroll-1440-end.jpg
.local/memecatch-home-qa-5xewg8/scroll-375-start.jpg
.local/memecatch-home-qa-5xewg8/scroll-375-middle.jpg
.local/memecatch-home-qa-5xewg8/scroll-375-end.jpg
.local/memecatch-home-qa-5xewg8/scroll-static-fallback.jpg

Full final browser report:
.local/memecatch-home-qa-RYzWE2/report.json

Reproduce:
MEMECATCH_QA_ORIGIN=http://127.0.0.1:3106 node scripts/qa-unified-home.mjs --scroll-only --workspace-artifacts --jpeg
MEMECATCH_QA_ORIGIN=http://127.0.0.1:3106 node scripts/qa-unified-home.mjs --web3 --polish --workspace-artifacts --jpeg

## Scope / remaining limitations

Testing used the existing loopback development preview at port 3106 and disposable Chrome profiles. No production build or deployment was performed in this task. Physical phone GPU, Safari and a full WCAG conformance audit were not tested. Synthetic browser touch input is not a physical-device test. Initial mobile scroll progress can differ slightly because translated titles have different heights, but progress uses the same stage-relative geometry in every language.

DevSpace briefly lost connectivity during final regression work, then recovered. Both reviewer findings were fixed and both final browser suites completed after recovery. No remaining connection blocker is claimed from the earlier interruption.

Existing unrelated dirty files, environment files, production DB/AdSense settings, commits and hosted deployment were not changed. Port 3105 still serves the older preview; use 3106 for this implementation. Disposable QA Chrome processes are closed by each script. The existing preview server was not stopped.
