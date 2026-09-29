# Full-width section-linked home story

## Implemented request

The user corrected the previous implementation: the first screen must NOT divide into left text and right 3D. It must be one integrated composition, with separate sections that drive the same 3D asset on scroll. This release replaces the former split hero; it does not merely add another effect to it.

## Result

- One full-width centered text/3D composition. No hero two-column layout or boxed right-hand demo.
- Three real server-rendered story sections: discover, context, participate.
- One persistent Three.js canvas across all three sections. Existing physical stacked/spread poses and bounded rotation follow progress continuously and reverse on upward scroll.
- Whole-story scroll measurements exclude the chapter navigation. Chapter-aligned target progress is 0, 0.5 and 1; rendered poses damp toward those targets.
- Three native section anchors, a latest-content skip link, a real localized search form, and real signals/community/product links.
- Existing recent-content filtering, usage guide, community/product entry points, editorial section, metadata/SEO and data queries retained.
- Shared layout and motion rules for Korean, English, Japanese, Simplified Chinese and Traditional Chinese. Copy only varies by locale.
- Previously visible dashboard moved into a collapsed native Scene controls disclosure; pause remains visible. Existing manual layouts, signal buttons, reset and keyboard access retained.

## Integration/QA fixes

1. Cold-render bootstrap: initial fallback/canvas placement must be in the first composition before lazy loading, not after three sections. Reproduced old candidate with stage top 3376px, then corrected the base grid independent of WebGL readiness.
2. Natural-flow visuals have an explicit height, including no-WebGL/reduced-motion/short-screen layouts. No zero-height absolutely positioned fallback.
3. Text layers are click-through except actual content/actions. Verified real hit-testing reaches the canvas.
4. Removed duplicated bottom padding so mobile panels do not cover scene controls. Open controls have the appropriate stacking level.
5. Keyboard DOM order is first chapter/search -> shared scene controls -> later chapter actions; no jump past three offscreen sections to reach a visible control.
6. Added an optional geometric range to the scroll binding; ready-state ownership stays on the outer story but progress excludes nav height.
7. Story intersection margin is 0px so fully offscreen artwork no longer continues drawing within the previous 96px preload margin.
8. Runtime GPU loss retains already-established story geometry until unmount while disposing progress listeners. The SVG stays visible at the current chapter instead of jumping above the viewport. Initial WebGL failure still uses compact natural flow.

## Verified

Final unit run:

```sh
pnpm exec vitest run --maxWorkers=4 --testTimeout=30000 --reporter=dot --silent
```

- 357 test files passed.
- 2,572 tests passed.
- TypeScript `--noEmit` passed.
- Scoped ESLint for the changed components, utilities and copy passed.
- `git diff --check` passed.
- QA runner/module syntax checks passed.

Final browser command:

```sh
MEMECATCH_QA_ORIGIN=http://127.0.0.1:3106 node scripts/qa-unified-home.mjs --cinematic --workspace-artifacts --jpeg
```

- 63 checks passed.
- Five locales at 1440px, 768px, 375px: 15 combinations.
- Full-width horizontal alignment of headings and scene; exactly one H1 and one canvas.
- Three physical story chapters with native links and real search routes.
- Same canvas identity through forward and reverse section changes.
- Native mouse wheel and mobile touch swipe advance actual rendered poses.
- Search-to-controls Tab ordering, disclosure opening, Escape focus restoration.
- Pause/resume; manual layout override and restored scroll ownership.
- Story releases into latest content; no blocking visual overlay; offscreen GPU frames stop.
- GPU context loss from the middle chapter retains visible SVG and unchanged chapter position.
- Reduced-motion and no-WebGL paths keep the content without pinning.
- 320x568 short-screen spot check has no horizontal overflow or pinned trap.
- Collected JS exceptions: zero. Broken images: zero. Actual ads not loaded by the preview.

Evidence:

```text
.local/memecatch-home-qa-SavCDL/cinematic-report.json
.local/memecatch-home-qa-SavCDL/cinematic-1440-discover.jpg
.local/memecatch-home-qa-SavCDL/cinematic-1440-context.jpg
.local/memecatch-home-qa-SavCDL/cinematic-1440-participate.jpg
.local/memecatch-home-qa-SavCDL/cinematic-768-discover.jpg
.local/memecatch-home-qa-SavCDL/cinematic-375-participate.jpg
.local/memecatch-home-qa-SavCDL/cinematic-mid-story-gpu-fallback.jpg
```

Parent visually inspected desktop chapter compositions and mobile results, including the final generation. Independent review identified the bootstrap/fallback/control stacking/DOM ordering/progress range/runtime context-loss issues listed above; fixes were reproduced and verified with unit and native browser tests.

## Main files

```text
components/home/home-immersive-story.tsx
components/home/home-immersive-story.module.css
components/home/home-story-scene-view.tsx
components/home/home-story-scene-view.module.css
components/home/home-scene.tsx
components/home/home-scroll-binding.ts
components/home/home-experience.tsx
components/home/home-web3.module.css
lib/home-immersive-copy.ts
lib/home-scene-copy.ts
scripts/qa-home-cinematic.mjs
scripts/qa-unified-home.mjs
```

## Boundaries

Implemented in the original dirty ~/projects/memecatch checkout. No Git reset, commit, push, production DB writes, AdSense changes, dependency installs or deployment. Existing read-only development preview at 127.0.0.1:3106 remains the current view; 3105 is an older unrelated preview. No production build was run in this iteration. Browser coverage is Chrome desktop plus responsive/touch emulation, not physical mobile GPU or Safari testing, and is not full WCAG certification. Legacy split-hero QA modes are historical; use the cinematic QA command for the new composition.
