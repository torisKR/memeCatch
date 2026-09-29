# MemeCatch interaction-quality refinement

## Intent and scope
The user requests a further quality upgrade of the existing Web3-inspired home, not blockchain/finance functionality. Continue the authorized original-checkout local workflow under AGENTS.md. Preserve accumulated uncommitted work. No deployment, process killing, account changes, DB writes, new dependencies, or Git commit/push. Reuse the read-only development preview on 127.0.0.1:3106; do not touch the old 3105 build/server.

## Design brief
Retain charcoal/orange/ivory visual identity and real content. Upgrade the feel rather than adding ornamental clutter: a stacked/spread 3D composition selector, frame-rate-independent damped pointer response, dimensional editorial cards with localized pointer lighting, and a compact active-section chapter rail. Keep real full-site search and the actual recent-only filter distinct. Reduce excess hero space on mobile; never hijack scrolling or hide primary content before JavaScript.

## Independent lanes and contracts
- Renderer lane owns home-scene-renderer.ts, home-studio-artwork.ts, their renderer tests and lib/home-scene-layout.ts only. Export HomeSceneLayout = 'stacked' | 'spread'. Renderer options layoutMode?: HomeSceneLayout; controller setLayoutMode(mode). Expose data-layout-mode and data-layout-progress on canvas for QA. Default stacked; resetView resets orientation but preserves selection/layout. Smooth while playing; apply immediately, one frame only when paused. Tokens remain selectable in both modes with occlusion-aware raycasts; bound camera at both endpoints plus rotations. No extra animation loop or renderer recreation. Keep DPR and cleanup guarantees.
- Card lane owns home-discovery.tsx, home-discovery.module.css, their tests, plus a small pointer-surface helper and its tests if needed. Preserve native links, all real content/filters/locale semantics. Add restrained perspective tilt/spotlight on fine-pointer only, original abstract editorial artwork, focus equivalent, exact reset on pointerleave/media change/unmount, no touch scroll interference, reduced motion honored. No unbounded animation frames or rerender per mousemove.
- Parent owns HomeScene UI/copy and tests; accessible native radio layout switch, keeps four signal buttons and fallback. Disabled layout switch while no renderer with a truthful label. Add compact chapter nav with native anchors and aria-current, passive RAF-throttled updates, no history rewriting or forced scroll. Refine hero spacing/typography and card integration while preserving SEO.

## Verification
- Regression-first tests for each behavioral change.
- Full Vitest and TypeScript; scoped ESLint; scripts node syntax checks.
- Real Chrome 5 locales and mobile/tablet/desktop, current scripts plus new checks: stacked/spread geometry transition, paused/no-motion immediate state, drag/raycast/selection, card tilt & leave reset & coarse-pointer inertness, native section navigation and aria-current updates, no overflow and no JS errors.
- Fresh screenshot inspection at mobile/desktop and both scene layouts. Report limitations precisely, not test counts as a design guarantee.

## References
- https://threejs.org/docs/pages/MathUtils.html — delta-based damp.
- https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events — scoped input and native touch behavior.
- Local installed Next docs: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md.
