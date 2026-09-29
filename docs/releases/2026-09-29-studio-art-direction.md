# Studio art direction refresh — 2026-09-29

## What changed

The user rejected the preceding toy-like interactive home artwork. This pass changes the visual direction, not the service's editorial/business behavior.

- Removed the smiling face, eyes, feet, trophy plinth and overlapping orbit/satellite decoration.
- Added a hollow, beveled orange speech-loop emblem, deliberately tilted to reveal thickness, with two staggered chrome-rimmed ivory editorial cards.
- Replaced the beige scene/side inspector with a graphite full-width studio, subdued oversized CATCH backplate, and a compact dock below the stage.
- Generated studio reflections once per mount with bundled RoomEnvironment/PMREM. No downloaded models, textures, HDRs, stock images or added packages.
- Parent screenshot inspection found the first lighting draft too pale. Exposure, ambient/key/fill intensity and environment strength were reduced. Token face roughness was increased and clearcoat/environment reflection reduced so green/red/yellow/gray retain identifiable color.
- Stage height now 256px mobile, 340px tablet, 390px desktop. The educational notice is always visible within the native details summary rather than occupying a separate row. Native controls remain at least 44px high.
- The original SVG fallback was redrawn to match the hollow emblem/cards and its signal positions were aligned with the WebGL scene.
- Korean, English, Japanese, Simplified Chinese and Traditional Chinese figure labels now describe the actual emblem rather than the retired mascot.

## Main source files

- components/home/home-studio-artwork.ts — geometry and tracked material/geometry lifecycle.
- components/home/home-scene-renderer.ts — studio lighting/environment plus preserved pointer/raycast/controller lifecycle.
- components/home/home-scene.tsx — studio shell and compact accessible controls.
- components/home/home-scene-fallback.tsx — local vector alternative.
- components/home/home-experience.tsx — studio marker, removal of redundant peach background wash; existing home structure/routes retained.
- lib/home-copy.ts / lib/home-scene-copy.ts — matching five-language copy.
- Focused tests in the corresponding home files and copy tests.
- scripts/qa-unified-home.mjs — explicit allowlist for the two loopback preview origins and optional project-local QA artifact output.
- scripts/qa-home-interactions.mjs — updated actual-click sampling coordinates for the shorter stage, retaining the same raycast-selection assertion.

## Verified results

Fresh parent verification on Node 24.16.0:

- Full Vitest: **350 files, 2,499 tests passed** with 4 workers and 30s per-test timeout.
- TypeScript --noEmit: passed.
- Scoped application ESLint: no errors. The two QA scripts are excluded by repository ESLint configuration (warnings were emitted); both passed node --check and actual browser execution.
- git diff --check: passed; no staged changes.
- New preview Korean and English routes: HTTP 200.
- Full disposable Chrome QA on the new preview: all five locales at 375/768/1440 pixels, preserved common home sections, no horizontal overflow, no broken images, no advertising runtime, and no captured JavaScript exceptions.
- All twelve interaction assertions passed, including real keyboard selection, real mouse drag, reset, actual raycast token click, hover, native touch pan versus rotation, and no-WebGL selection.
- Draw-call checks verified pause/resume/reduced-motion/offscreen behavior; context loss, save-data and low-memory alternatives worked.
- Final Korean desktop/mobile screenshots were inspected directly, in addition to earlier English-mobile and dark-desktop iterations.

### Regression work and an observed QA failure

New expectations were first observed failing for retired mascot labels, studio integration, restrained lighting, three-quarter orientation, token-face reflectivity, compact panel height, and fallback spatial parity, then passed after the changes.

The first full run after shortening the stage failed the actual token-click assertion because its old fixed screen samples no longer hit the token. The rendered screenshot showed the red token near normalized (0.36, 0.36). Sampling was corrected to that observed location; the final test used native mouse input and verified the shared React state, not a synthetic callback. No assertion was removed or converted into an expected failure.

## Evidence

Baseline desktop:
`.local/original-qa-20260928/screenshot-1790608576791.png`

Final successful browser run:
`.local/memecatch-home-qa-lur3kZ/report.json`

Screenshots in the same directory include `ko-1440.png`, `ko-375.png`, `en-375.png`, `dark-reduced-motion.png`, `interactive-red-desktop.png`, `interactive-mobile.png`, and `interactive-fallback-mobile.png`.

Earlier unsuccessful pointer sampling run retained:
`.local/memecatch-home-qa-p9s0FP/report.json`

Earlier lighting iterations retained:
`.local/memecatch-home-qa-jivPZO/` and `.local/memecatch-home-qa-iw2P11/`.

## Preview and safety boundary

**New design:** http://127.0.0.1:3106/?lang=ko and /en (also /ja, /zh, /zh-tw).

The development server listener was verified as PID 58094 at final check; the launch-parent PID was 58092. These PIDs are historical observations, not safe-to-kill instructions; check ownership before any later process operation. Log: `/tmp/memecatch-studio-preview-20260929.log`.

The old production-mode preview at 3105 was left untouched. The requested stop-old-server/build command was blocked by the tool security gate. No attempt was made to disable or bypass that gate. A separately authorized development preview uses Next's isolated `.next/dev` output on 3106, leaving the existing `.next` production artifact unchanged.

Preload `.local/studio-preview-runtime-20260929.mjs` reuses the existing read-only production-data guard and ad-disabled preview configuration, then sets only the process-local loopback origin. Actual environment files were not modified. Do not use this preview for uploads, sales, moderation or production writes.

Reproduce the browser run:

```sh
MEMECATCH_QA_ORIGIN=http://127.0.0.1:3106 node scripts/qa-unified-home.mjs --workspace-artifacts
```

## Explicit verification gaps

- A fresh production build was **not** completed in this pass; the compound stop/build tool action was blocked before execution. Do not substitute a previous release's build result or describe development compilation as production build success.
- Independent review was delegated, but retrieving the review result was blocked; no independent-review approval is claimed. Parent source, regression and visual checks were completed.
- No physical-phone GPU benchmark, Safari pass, Lighthouse score or complete WCAG certification is claimed.
- Visual style remains subjective. Screenshots show a materially changed composition, not proof of the user's aesthetic approval.
- No commit, push, deployment, Google account mutation, AdSense change, content rewrite, package installation or hosted database modification was performed.
