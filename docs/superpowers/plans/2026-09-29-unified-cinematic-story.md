# Unified cinematic home story — implementation plan

**Goal:** Correct the previous misunderstanding: remove the left-copy/right-3D split completely. Build one full-width, layered text-and-3D scene that continues through three real scroll sections on every home locale.

**User brief:** The user explicitly rejected the half-and-half hero and requested a unified composition with section-by-section scroll interactions. Existing project autonomy instructions authorize reversible local implementation and verification without another permission handoff.

**Design:** Three real semantic chapters (discover → understand context → join/create) flow over one persistent central Three.js scene. Headings are centered at the top of the composition, artwork occupies the central visual field, and meaningful copy/actions occupy a readable lower overlay. No desktop left/right columns; no separate boxed demo or sidebar. Native scrolling advances the same scene from stacked through spread, reverses when scrolling up, and releases into the existing recent-content, signals, community/shop and editorial sections. Each chapter has an anchor. Search remains a real form, with a skip-to-content action. Mobile follows the same composition where usable; reduced-motion, no-WebGL and short-height screens retain all content in a compact natural-flow layout.

**Architecture:** HomeImmersiveStory (server-renderable) supplies the shared track, sticky visual layer and semantic chapter content; HomeScene adds a `story` variant while preserving `hero` and `studio`. Existing scroll binding and renderer APIs are reused. One canvas, one renderer loop. Localized copy is data only; no locale-specific layout branches. Existing controls remain available in a collapsed native disclosure so the artwork does not become a control panel. No new dependencies.

## Constraints
- Work in ~/projects/memecatch, preserve existing dirty changes; do not commit/reset/push/deploy or change production DB, auth or AdSense.
- Reuse the existing read-only dev preview on 127.0.0.1:3106; do not kill other servers.
- No scroll hijacking, preventDefault wheel handlers, fake metrics/content, hidden essential SSR content or timed autoplay chapter navigation.
- Keep pointer/touch, pause, reduced-motion, WebGL fallback and cleanup contracts.
- Do not claim physical device or Safari coverage from Chrome emulation.

## Tasks
- [x] Regression-first server markup/copy tests for three chapters, single scene, centered shared composition, real links/search, all five locales.
- [x] Implement HomeImmersiveStory + localized copy + page integration, remove obsolete split-hero markup/styles while keeping downstream sections.
- [x] Add story scene variant with compact accessible overlay controls, reuse whole-story progress, keep actual geometry rendering and manual overrides.
- [x] Inspect screenshots at desktop and mobile chapter positions and correct overlap, sticky geometry or readability issues.
- [x] Run scoped/full unit tests, TypeScript, scoped lint; verify live scroll forward/reverse across all locales, same canvas identity, section release, pause/fallback/reduced-motion and keyboard/touch.
- [x] Independent review and final evidence report. Keep preview running after closing disposable QA browser.
