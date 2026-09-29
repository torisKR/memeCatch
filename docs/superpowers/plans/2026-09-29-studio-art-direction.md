# MemeCatch Studio Art Direction — implementation plan

## Intent and scoped design
The user rejects the current assets as visually weak and asks for a substantive upgrade. Improve the existing interactive home artwork, not SEO/AdSense/business functions. Keep the original checkout and its uncommitted changes. The project directs autonomous execution for clear reversible local work.

Visual target: replace the flat front-facing toy face, trophy plinth and repeated hairline orbits with an art-directed studio still life. One oversized hollow rounded-square speech-loop emblem in saturated orange enamel, visibly beveled/thick with a speech tail, tilted in three-quarter view. Two staggered silver/ivory editorial cards, restrained metal rim details, and four separately identifiable signal tokens. Dark graphite studio background, subtle oversized typographic backplate and carefully separated foreground/background. No eyes, mouth, feet, toy plinth or extraneous satellite swarm. Neutral studio image-based lighting gives real readable highlights; no downloaded HDRs, stock images, textures, or models.

Controls become a compact integrated dock below the artwork, not an educational inspector occupying a third of the desktop hero. Retain the existing explanatory content in a small expandable area. Visible plain-text signals and selected descriptions remain accessible even without WebGL. Korean and all four localized homes share the result.

## Boundaries
- Original ~/projects/memecatch on main. No reset, stash, clean, commit, push, deploy, external mutations, package changes or credentials.
- Existing controller API and Canvas data markers, real raycast selection including foreground occlusion, bounded drag/hover, reset, touch pan-y/pinch, pause/visibility/reduced-motion, SVG fallback and disposal all remain.
- No extra rendering framework or package. Installed Three.js only. RoomEnvironment and PMREM from the installed version are available; use existing official docs and local source before API changes.
- At most one small environment generated per mount, disposed on every cleanup path; no per-frame PMREM generation, postprocessing pipeline or shadow cascade. Limit DPR to 1.5. Visual polish must not depend on excessive draw calls.
- Source-status labels are UI demonstrations, never a changed real meme verdict or permission grant.

## Lanes and exact ownership
### RENDERER lane
Own components/home/home-scene-renderer.ts and its test. May extract an artwork helper into components/home/home-studio-artwork.ts and own its tests if it makes scene construction clearer. No edits to UI/fallback/copy/browser scripts. Implement the composition/material/lighting transformation and preserve interactions. Replace obsolete mascot-specific tests with meaningful new geometry, bounded resource, material/environment cleanup, framing and interaction assertions. Keep all behavioral regression coverage.

### UI lane
Own components/home/home-scene.tsx, components/home/home-scene-fallback.tsx, lib/home-scene-copy.ts and their existing or new targeted tests. Keep lifecycle logic and API stable. Full-width graphite stage approximately 288px mobile, 390px tablet, 450px desktop; responsive compact dock with four >=44px buttons (2x2 mobile / four in row from sm), brief live status and native details. Dark stage remains intentional in either site color scheme. No clipping via a fixed overall figure height. SVG fallback depicts the same hollow-orange-speech-loop/silver-cards composition. Unique gradient IDs, selection indication, no external resources. Keep controller markers for QA.

### Parent lane
Own homepage integration/copy-label adjustments only where needed, existing browser QA adaptations, temporary preview management, independent visual inspection and final evidence. Do not change other user work. Read and inspect previews rather than infer visual quality from test counts.

## Verification sequence
- [ ] Capture the current desktop composition; record visual defects.
- [ ] Add and observe failing focused tests for new behavior/geometry where appropriate.
- [ ] Implement lanes and check targeted tests/typecheck/lint.
- [ ] Fresh independent code review of material/texture disposal, interactions, accessibility, touch and fallback.
- [ ] Build with existing local read-only/ads-disabled preload; restart only the verified project preview process on 127.0.0.1:3105.
- [ ] Inspect real screenshot results at 375px and 1440px; adjust framing/light exposure until the new silhouette/material/composition are genuinely distinguishable from baseline.
- [ ] Run five-locale responsive and interaction scripts, including no-WebGL, reduced motion, selection, pointer/touch and raycast occlusion.
- [ ] Final full tests, static checks, report exact results and remaining caveats; leave requested local preview running. No production success claim.

## Official references
- https://threejs.org/docs/pages/MeshPhysicalMaterial.html — environment map needed for convincing PBR; advanced effects cost per pixel.
- https://threejs.org/docs/pages/RoomEnvironment.html — bundled procedural studio environment, no HDR download.
- https://threejs.org/docs/pages/PMREMGenerator.html — generate once and dispose generator/target.
