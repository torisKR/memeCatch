# Interactive 3D home — 2026-09-28

## Scope
Implemented in the original /Users/toris/projects/memecatch checkout. Preserved the existing dirty SEO, international home, four-signal system, community, creator-products and advertising work. No deployment, Git commit/push, database mutation, Google account change or new dependency was performed.

## Delivered experience
- Replaced the passive top-stage experience with a localized interactive display and compact native HTML controls.
- Original Three.js geometry: orange speech mascot, layered cream cards, glossy plinth, accent halo, secondary orbital rail and small satellites.
- Four modeled signal tokens use distinct glyphs and corresponding colors. Selecting one changes its ring/scale/glow and the plinth accent, while keeping the mascot orange.
- Mouse hover gives restrained tilt. Primary horizontal mouse/touch dragging rotates the view within camera-safe pitch/yaw bounds. Reset restores the view without changing the selection.
- Actual token picking uses Three.js raycasting, not invisible HTML hotspots. The HTML selection, live explanation and SVG fallback remain synchronized.
- Four 48px native buttons with aria-pressed and a named group work with keyboard input. Long details are an optional native disclosure. A visible notice distinguishes this explanatory demo from any real meme verdict or legal permission.
- Korean, English, Japanese, Simplified Chinese and Traditional Chinese receive matching controls and explanations through the existing shared home.
- Vertical touch scroll and pinch zoom remain allowed. A drag is not treated as a token click. Pointer cancel/lost capture and disposal release the interaction state.
- Existing lazy loading, DPR <= 1.5, pause, visibility/offscreen suspension, reduced motion, context-loss recovery, Save-Data and low-memory fallback remain intact. Static SVG visitors can still select and read signals.

## Files
- components/home/home-scene-renderer.ts
- components/home/home-scene-renderer.test.ts
- components/home/home-scene.tsx
- components/home/home-scene.test.tsx
- components/home/home-scene-fallback.tsx
- components/home/home-experience.tsx
- components/home/home-experience.test.tsx
- lib/home-scene-copy.ts
- lib/home-scene-copy.test.ts
- scripts/qa-unified-home.mjs
- scripts/qa-home-interactions.mjs
- docs/superpowers/plans/2026-09-28-interactive-3d-home.md

Local-only launcher: .local/start-interactive-preview.mjs. It imports the existing read-only design-preview configuration, disables real ad traffic and appends its log outside the checkout.

## Fresh verification
Final source verification, Node 24.16.0:
- Full Vitest: **349 files / 2,496 tests passed**, with maxWorkers=4 and testTimeout=30000.
- TypeScript --noEmit: passed.
- ESLint on changed home/copy files: passed.
- git diff --check: passed.
- Final local production-mode build: passed; 96 static pages generated. Three pre-existing special-route metadataBase warnings remain. This artifact has loopback preview configuration; do not deploy .next without rebuilding with the real deployment configuration.

Final disposable Chrome browser regression:
- All 15 combinations of five locales and 375/768/1440 widths had the shared five-section order, four signal disclosures, four interactive controls, expected selected language, no observed overflow, no broken images and no AdSense script.
- Real WebGL draw calls verified ambient play, pause, resume, reduced-motion pause and restoration, offscreen suspension and return-to-viewport resume.
- Deliberate GPU context loss retained the SVG fallback.
- No-WebGL, Save-Data and deviceMemory=2 used static fallback with zero GPU draws.
- Four original signal disclosures opened/closed via native Enter events.
- **12 interaction checks passed:** native control count; four keyboard selections; actual mouse drag while ambient animation was paused; view reset; actual 3D token click; fine-pointer hover; real vertical touch scrolling; real horizontal touch rotation; no-WebGL selection/explanation.
- Recorded mouse drag yaw: 0 -> 0.480 radians, while selected signal stayed unchanged. Reset returned pitch/yaw to zero.
- Actual raycast click selected red and updated the HTML button state.
- Fine-pointer hover yaw: 0.042 radians.
- Vertical touch gesture scrolled the page 163 CSS pixels without selecting or rotating; horizontal touch drag produced yaw 0.432 radians without selecting.
- Captured JavaScript exceptions: zero.

Final report and 27 screenshots:
/var/folders/1k/hsqljbyj4c9_ky4dsfh26k1r0000gn/T/memecatch-home-qa-XO32RW/report.json

Earlier successful browser run before the occlusion fix:
/var/folders/1k/hsqljbyj4c9_ky4dsfh26k1r0000gn/T/memecatch-home-qa-12V4dl/report.json

Native screenshot inspections of desktop and mobile confirmed the actual stage/control composition. Representative captures are under .local/original-qa-20260928/: screenshot-1790603376558.png, screenshot-1790603621925.png and screenshot-1790603622076.png. Early screenshots can catch the brief fallback-to-GPU fade; the settled renderer hides the SVG.

Scoped axe audit on the mobile hero: zero violations, one incomplete contrast check concerning the image-backed reset control. This is not complete WCAG certification.

## Defect found in independent review and corrected
The first picker only raycast token objects and could select a token behind an opaque mascot/card. A new regression inserted a visible blocker between the camera and the red token, reproducing the failure. The picker now considers the nearest visible mesh/material surface across the scene, filtering hidden ancestors and invisible materials. The test verifies that an occluded token is not selectable and becomes selectable when the blocker is hidden. Renderer suite: 15/15 passed; full suite and real browser regression were rerun after the fix. The final independent re-review result lookup was blocked by the tool security gate, so no second reviewer approval is claimed.

## Running local preview
Origin: http://127.0.0.1:3105
Korean: /?lang=ko (use a Korean Accept-Language header for a bare HTTP probe because existing root negotiation can redirect other preferences).
Other homes: /en, /ja, /zh, /zh-tw.
Final launched PID: 37507. Check current port/process ownership before any later stop; PIDs can be reused.
Log: /tmp/memecatch-interactive-preview-20260928.log
The preview is intentionally kept running on loopback for the user. The disposable QA browser closes itself. Do not use this read-only preview for real purchases, submissions, uploads or moderation.

## Honest limits and skipped checks
- Responsive Chrome and native CDP touch events are not physical-phone GPU measurements or Safari validation.
- This task does not certify AdSense approval or change account status.
- Some compound shell inspection/test requests were blocked by the tool security gate. No permission or policy was changed. The normal standalone browser regression completed successfully afterward.
- The separate qa-seo-publisher.mjs attempt did not run: it intentionally refuses to start when port 3105 is already occupied by the preview. Existing preview was left intact. No additional SEO HTTP smoke pass is claimed for this task; full application tests and existing source contracts passed.

## Reproduce
With the preview running: node scripts/qa-unified-home.mjs
If the preview is stopped and a local design build exists: node .local/start-interactive-preview.mjs

Official implementation references:
https://threejs.org/docs/pages/Raycaster.html
https://threejs.org/manual/pages/how-to-dispose-of-objects.html
