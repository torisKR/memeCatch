# Interactive 3D Home — implementation brief

## Goal and scope
Upgrade the existing original MemeCatch checkout with useful interactive 3D graphics, not another passive animation. Keep the existing orange mascot, shared five-language home, search/content, SEO, advertising controls and all unrelated uncommitted work. The user explicitly requested implementation on the existing website; AGENTS.md permits continuing reversible local edits without another permission handoff.

## Design
An interactive display at the top of the home combines a sculptural orange mascot, beveled floating cards, an orbit frame and four visibly distinct signal tokens. Add a glossy display/plinth and restrained orbital/satellite details made with local Three.js geometry. Direct horizontal dragging changes the view, fine-pointer hovering adds a subtle tilt, and selecting a token highlights its geometry and explains that usage signal in the adjacent/on-mobile-below HTML panel. This is an educational demo, not a safety judgment of any meme. Search and all other content remain server-rendered.

Desktop: a clearly visible 3D stage with a compact editorial control panel; mobile: compact stage then 2x2 accessible signal controls, with no horizontal overflow or captured vertical page scrolling. Use existing warm cream/orange design tokens. Do not add third-party model/image dependencies.

## Shared renderer interface (owned by renderer lane)
Reuse SafetyLevel from lib/labels (green/yellow/gray/red).
HomeSceneRendererOptions adds optional selectedSignal: SafetyLevel and onSignalSelect: (level: SafetyLevel) => void.
HomeSceneRendererController adds setSelectedSignal(level: SafetyLevel): void and resetView(): void, preserving dispose and setPaused.
Initial selectedSignal is green. The orange mascot remains orange; token face, selection ring and stage accents indicate selection.
Canvas exposes data-selected-signal and data-view-yaw/data-view-pitch for state-based QA, not artificial performance claims. Mark selected token groups with userData.signalLevel for picking.

## Renderer lane
Own components/home/home-scene-renderer.ts and dedicated renderer tests. Keep lifecycle API, DPR <= 1.5, resource disposal, context-loss cleanup, pause/offscreen behavior and robust camera framing. Integrate local graphical additions with resource tracker. PointerEvent interactions: primary button only, real drag threshold, pointer capture cleanup, pointercancel/lostcapture cleanup, no click-after-drag, touch-action pan-y pinch-zoom, bounded yaw/pitch; preserve vertical page scroll. Fine-pointer tilt only when not paused. Explicit drag/selection can render a single frame while paused without starting an ambient loop. Raycast actual visible tokens; no fake hotspots. No global wheel handling, pointer lock, network fetches or new dependencies.

## UI lane
Own components/home/home-scene.tsx, home-scene-fallback.tsx, their tests, and new lib/home-scene-copy.ts/tests. Add optional locale prop (SeoRouteLocale, default ko); preserve existing label/pauseLabel/playLabel. HTML buttons for all four signals use SafetyIcon, localized labels, aria-pressed and a named group; changes update an aria-live=polite explanation, renderer selection and SVG fallback selection. Reset-view control and clear drag/tap instructions. Keep existing visibility/reduced-motion/save-data/low-memory support. Static fallback users can select and read all four signals without WebGL. Do not claim legal permission, automatic factual validation, or AdSense approval. Keep figure[data-renderer], data-home-scene-canvas and data-home-scene-fallback markers. Put data-scene-playback on the pause button so browser QA does not use first-button assumptions.

## Parent integration/QA
Pass locale through HomeExperience; remove old fixed outer height if needed while preserving stage-first order, exactly one h1, current section order and usable search. Maintain automatic home-modal suppression. Extend existing disposable-profile browser checks to specifically address the playback button and assert selection via keyboard and real raycasts, drag versus click, reset, mobile vertical scroll, fallback selection, five locales and widths, no overflow, no ad script/production writes. Inspect actual screenshots. Run focused TDD, full Vitest, TypeScript/lint, local production-mode build and HTTP smoke. Reuse the read-only design preview configuration and only restart its own verified process on 127.0.0.1:3105. No deployment, git commit/push, Google account change or DB writes.

## Evidence and references
Record failing regressions before behavior changes, then green results and remaining limitations in docs/releases. Browser emulation is not a physical-device GPU benchmark. The existing site has multiple dirty prior changes; do not reset or overwrite unrelated files.
Official technical references consulted:
- https://threejs.org/docs/pages/Raycaster.html
- https://threejs.org/manual/pages/how-to-dispose-of-objects.html
- node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md
