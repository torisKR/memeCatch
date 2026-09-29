# Home Scroll Story Implementation Plan

**Goal:** Make the existing homepage 3D composition visibly and reversibly follow native page scrolling, with one shared UI/UX across ko/en/ja/zh/zh-tw.

**Design:** Keep the current editorial / orange studio identity and real content. Desktop uses a short, progressively enabled sticky hero (only when the viewport can fit it); mobile/short viewports use normal document flow and map the stage's passage through the viewport. Scroll mode is the default on the shared hero. Manual Stack/Spread modes remain available and stop scroll control until Scroll is chosen again. Scroll rotates the physical Three.js root and continuously interpolates existing stack/spread object transforms; scrolling up reverses it. A modest, localized 3-step progress cue explains the interaction. Never hijack wheel/touch, create fake metrics, change actual safety verdicts, or pin the entire page.

**Architecture:** Add a DOM-only scroll binding with event-driven, coalesced reads; no React state updates per pixel and no perpetual extra RAF. Extend the existing renderer controller to accept normalized optional scroll progress. Keep one Three.js frame loop and all existing pointer/pause/disposal behavior. Extend HomeScene and HomeExperience rather than introducing separate locale pages. Published text remains SSR. No new dependencies.

## Constraints
- Original dirty checkout ~/projects/memecatch; preserve all unrelated edits. No git reset/commit/push.
- Do not deploy, write production data, or change env files, AdSense, authentication, routing or translations in the DB.
- Preview only on the already configured loopback 3106; inspect any server failure rather than claim QA success.
- Reduced motion, Save-Data, WebGL failure and no JavaScript keep useful static content without extra scrolling space.
- Pause freezes scroll-driven transforms. Returning to play or scroll mode synchronizes the actual current scroll position. Manual actions stay functional.
- Geometry and progress rules do not branch by locale. Copy is translated; actual localized records may differ.

## Tasks
- [x] Renderer: TDD option scrollProgress?: number | null and method setScrollProgress(progress: number | null). null disables scroll control. Finite [0,1] normalization. Continuous reversible layout + bounded rotation within existing camera envelope. Scroll setters do not render or start loops while paused; no extra RAF while active. Keep reset semantics, selection and manual modes. Prove physical transforms at endpoints/midpoint, reverse, invalid inputs, frame-rate damping, paused quietness, clipping and cleanup.
- [x] Parent integration: TDD DOM scroll binding, shared hero track/pin markers, consistent three-option controls and localized progress cue. Coalesce events, resize/visibility handling, initial mid-scroll position, cleanup. Desktop sticky progressive enhancement; mobile natural scroll.
- [x] Verify original project source with tests/typecheck/scoped lint. Browser: five locale desktop/mobile matrices, scroll down/up with actual physical transforms (not ambient motion), manual mode, pause, reduced motion, WebGL fallback, touch scroll, resize and language switch. Inspect screenshots at start/middle/end. Record any genuine limitations.
- [x] Review final focused diff and record evidence in docs/releases/2026-09-29-home-scroll-story.md.

## Renderer / parent interface contract
- Existing HomeSceneLayout stays 'stacked' | 'spread'. Renderer accepts scrollProgress number|null independently of manual layout.
- setScrollProgress(null) restores manual target without selecting a signal. Parent disables scroll before setLayoutMode.
- Dataset scrollProgress indicates the rendered normalized progress (not merely requested), scrollTarget indicates normalized requested progress, scrollControlled indicates whether scroll is driving layout. Existing layoutMode/layoutProgress/viewYaw/viewPitch remain for regression QA.
- Scroll rotation is additive to pointer pose but clamped within existing MAX_VIEW_YAW/PITCH. No claims of measured frame performance from unit tests.
