# Interactive home polish — 2026-09-29

## Scope and state
Original checkout: /Users/toris/projects/memecatch, existing dirty main. Continued the user-authorized local design renewal. No deployment, database/account changes, dependency installation, Git staging/commit/push, or process killing. Existing development preview is 127.0.0.1:3106; old 3105 server is untouched. The preview uses the existing read-only/ads-disabled runtime.

## Implemented
- Real stacked/spread 3D poses for symbol, cards and tokens, with visible separation and frame-independent damped interpolation. Native radio controls have five-locale labels. Reset restores orientation without silently changing the selected signal/layout.
- Smooth pointer targeting while playing; immediate single-frame manual changes while paused. The existing one animation loop, visible-token raycast ordering, capture/cancel cleanup, touch vertical scrolling, reduced-motion behavior, DPR cap and resource disposal remain.
- New original editorial SVG card art; bounded fine-pointer tilt and local spotlight without React rerenders per movement. Native detail links, source content, safety badges, Unicode/category filtering, genuine counts and next-pick behavior remain. Pointer leave, media changes and cleanup reset styles. No false popularity or fabricated entries.
- A native-anchor sticky chapter rail with exactly one aria-current location marker, passive scroll handling and one scheduled update per frame; no custom scroll hijacking or history rewriting.
- Tighter mobile typography/search layout; substantial 3D stage is visible earlier without moving full-site search below it.
- Fixed review findings: desktop preview sticky offset clears header/chapter rail; darker paper-background text/focus ink; localized unique search-landmark names; explicit loading versus unavailable descriptions for disabled layout controls.
- Fixed a visual integration regression: inserting a toolbar invalidated the old :first-child ambient-background selector. It now uses data-scene-ambient, restoring the unboxed hero appearance.

## Verification evidence
Fresh full unit run: **354 files, 2,531 tests passed** with 4 workers and 30-second test timeout. Full tsc --noEmit, scoped ESLint (components/home and new scene types/copy), QA-script syntax checks and git diff --check passed in the same execution.

Recorded browser report:
`.local/memecatch-home-qa-9QCJ9X/report.json`
- localeMatrixValid=true: all 15 combinations of five locales and 375/768/1440 widths reached real ready canvases, matching document/selected language.
- 12 original interaction checks, 9 landing/discovery checks and 11 polish checks were individually successful.
- Actual native-input checks cover spread endpoint, immediate paused/reduced-motion layout change, no persistent paused frame loop, card tilt/light, leave reset, native chapter navigation, exactly one current chapter and compact mobile layout.
- Captured JavaScript exceptions: none. GPU loss and static modes remained usable.
- **This report's overall runner exited 1**, because the language-switch screenshot was taken after the new header arrived but before the streamed home body. That transient record had zero sections/controls; it is not counted as a successful language-switch end-to-end check.

The QA runner was strengthened to wait for route, language, full home body and renderer readiness, rather than a fixed delay. It now explicitly validates all 15 ready-canvas locale rows. Subsequent complete-run attempts encountered CDP Page.navigate timeouts (20 seconds, then 45 seconds) before completion. Do not describe the final all-in-one browser regression as passed. All assertions remain; none was deleted or marked expected-failure.

A subsequent local HTTP diagnostic returned a 302 locale redirect for an anonymous Korean-root request and 200 headers for /en, but the latter body exceeded the 12-second read window. The request-delay source was not established in this pass; do not claim a current performance SLA or blame Google/Supabase without evidence.

## Visual inspection
Confirmed visually through DevSpace native image reads:
- `.local/screenshot-1790650466060.jpg` — clean final integrated desktop hero, real layout selector and active chapter rail.
- `.local/memecatch-home-qa-9QCJ9X/polish-pointer-card.png` — new editorial card graphics, pointer response, corrected text contrast and chapter rail.
Other captured states include `polish-spread-desktop.png` and `polish-mobile-hero.png` in the report directory. Some large image reads timed out; do not represent every capture as manually reviewed.

Earlier exploratory report retained:
`.local/memecatch-home-qa-VzHAU0/report.json` — fixed-delay recording included loading/transient locale states and must not be used as an all-ready-canvas guarantee.

## Reproduce
With the 3106 preview accessible:

```sh
MEMECATCH_QA_ORIGIN=http://127.0.0.1:3106 node scripts/qa-unified-home.mjs --workspace-artifacts --web3 --polish
pnpm exec vitest run --maxWorkers=4 --testTimeout=30000 --reporter=dot --silent
pnpm exec tsc --noEmit --pretty false
```

## Remaining boundaries
No fresh production build/deployment in this pass. Physical-phone GPU, Safari, complete WCAG conformity and production authenticated workflows were not verified. The dedicated agent-browser session created for this pass was closed; the existing local preview was left untouched. Final consolidated browser rerun and local response-delay diagnosis remain open.

## References
Three.js delta-time damping: https://threejs.org/docs/pages/MathUtils.html
Native pointer/touch behavior: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
