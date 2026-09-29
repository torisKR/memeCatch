# Web3-inspired whole-home renewal — 2026-09-29

## Scope and runtime
Implemented in `/Users/toris/projects/memecatch`, preserving the dirty main checkout and prior SEO, multilingual routing, publisher controls, and 3D renderer work. User asked for Web3-like interactive design and functionality, not blockchain integration. No wallet, minting, token sale, fabricated live metrics, database writes, deployment, account settings, Git commit or push.

Current preview: `http://127.0.0.1:3106/?lang=ko`, English `/en`, plus `/ja`, `/zh`, `/zh-tw`. Existing authorized local development server on 3106 hot-reloaded these changes. The old production-mode preview on 3105 was not stopped or rebuilt. Existing read-only preview configuration retained; real submissions, purchases and moderation are outside this preview's purpose.

## Design changes
- Full-width obsidian hero with large localized headline, full-archive GET search and real explore/community CTAs before the single 3D scene in document order.
- Desktop split composition; mobile text/search first rather than a large demo pushing discovery out of reach.
- Backward-compatible `HomeScene variant="hero"` integrates the existing enamel/chrome artwork without a second GPU canvas or oversized boxed-demo appearance. Default studio variant preserved.
- Five native section anchors (top/latest/signals/participation/editorial), off-white editorial deck, large section numerals, and asymmetric community/product panels with original CSS motifs.
- Real safety badge kept on each entry rather than a separate duplicated list disconnected from its entry.
- Main consumer links and publisher/rights context preserved. No new dependency or remote asset service.

## Functional additions
`HomeDiscovery({locale, entries})` renders all genuinely supplied recent entries in initial server markup, then enhances them with category chips derived from those records and a Unicode-friendly recent-set text filter. This filter is explicitly not a full-archive search. It reports exact visible/total counts, allows no-result reset, and provides deterministic next-pick previews that link only to real current entries. Empty or one-entry inputs are handled without invented records; changes to the input corpus/locale reset filter and preview state.

Main changes: `components/home/home-experience.tsx`, `home-web3.module.css`, `home-discovery.tsx`, `home-discovery.module.css`, `home-scene.tsx`, `home-scene-hero.module.css`, associated tests, `lib/home-web3-copy.ts`, `lib/home-discovery-copy.ts` and tests. Updated browser checks in `scripts/qa-unified-home.mjs`, `qa-home-interactions.mjs`, and added `qa-web3-home.mjs`.

## Verified results
Final full Vitest: **353 files, 2,517 tests passed** (4 workers, 30s per-test ceiling). Final TypeScript `--noEmit`, scoped source ESLint, QA JavaScript syntax checks and `git diff --check` passed. Latest Korean-preference and English preview HTTP requests both returned **200**.

Successful live browser report:
`/Users/toris/projects/memecatch/.local/memecatch-home-qa-7yqWgL/report.json`

Coverage:
- Five locales at 375/768/1440 CSS-pixel widths, same home section order and no measured horizontal overflow or broken images.
- Actual WebGL rendering, pause/resume, reduced motion, off-screen suspension, context-loss fallback and three static-fallback conditions.
- Four native keyboard-operated signal disclosures and four 3D signal controls.
- **12 interaction checks passed**, including actual token raycast clicks, mouse drag, reset, hover, vertical touch scroll and horizontal touch rotation.
- **9 landing checks passed**, including initial search/heading/one-scene hierarchy, native chapter links, real Korean recent-set zero-result/reset/category filters, next-pick linking, participation links and mobile search-before-artwork.
- No captured JavaScript exceptions. English recent content was legitimately empty in one run; data-dependent discovery checks were run on actual Korean records instead of filling a fake translated feed.

Screenshots from that final run include `web3-desktop-hero.png`, `web3-mobile-hero.png`, `web3-latest-discovery.png`, `web3-community-products.png`, and the existing locale/fallback/interaction views. Mobile hero and community/product screenshots were directly inspected. A preliminary desktop screenshot was also directly inspected and revealed the layout issue fixed below.

## Issues caught and resolved
1. Negative inset/absolute positioning made the integrated scene extend beyond the desktop content boundary. Replaced it with in-flow, full-width sizing.
2. Entry safety labels were initially displaced to a secondary rail. Added a failing per-card regression, restored each record's real `SafetyBadge`, and removed the duplicate rail.
3. Dark theme tokens leaked into intentionally light editorial sections; product-card copy and decorative section numerals also had insufficient measured contrast. Scoped the light panel tokens and darkened affected text. A subsequent full-page dark-mode axe run reported **0 violations**; **91 contrast nodes remained incomplete** because the automated engine could not resolve graphical/pseudo-element backgrounds. This is not a complete accessibility certification.
4. The first browser regression used stale screen coordinates after scrolling the new mobile layout; horizontal touch missed the canvas. The test now reveals the real stage and re-reads its geometry after scrolling. Vertical-scroll validation was strengthened to require a delta rather than any existing scroll offset. All original interaction assertions retained and the full run passed again.

Initial failed browser evidence retained:
`.local/memecatch-home-qa-8jW4Vd/report.json`.

## Limitations and boundaries
- This pass verified the development preview, not a new production build or deployment. The existing 3105 production-preview artifact was left untouched.
- Physical-phone GPU, Safari, authenticated seller/moderator workflows, and live search-engine index changes are not certified by these checks.
- Independent reviewer-agent execution was blocked by the tool security gate; no independent-review approval is claimed. A later optional browser screenshot command was also blocked. Existing successful regression artifacts were used; no permission change or alternate route to the blocked action was attempted.
- No change to AdSense review status is claimed.

Reproduce the successful browser regression:

```sh
MEMECATCH_QA_ORIGIN=http://127.0.0.1:3106 node scripts/qa-unified-home.mjs --workspace-artifacts --web3
```
