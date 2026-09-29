# Web3-inspired MemeCatch home renewal

## Intent and scope
User asks to renew design and functionality as an interactive Web3-style website, following repeated home/3D iterations. This means an immersive consumer landing and usable discovery, NOT wallet connections, cryptocurrency, fake on-chain claims, NFT minting, invented metrics or a new backend. Apply to the original ~/projects/memecatch checkout; preserve existing dirty work. AGENTS.md explicitly authorizes autonomous, reversible local edit/test work. No production deployment, database or account mutations, dependency upgrades, commits, or process termination without separate authorization.

## Art direction / acceptance
Replace the stacked standalone demo-first layout with one integrated first screen: oversized meaningful localized headline + full-site search + real exploration/community CTAs on the left, edge-to-edge interactive orange/chrome 3D on the right (mobile: concise copy/search before stage). Obsidian hero, off-white editorial discovery, fine technical rules, large section numbers, rich asymmetric community/shop panels. Use existing orange emblem and one GPU canvas; remove noisy nested rounded-panel demo appearance in hero mode. No invented 'live', minted, user count, social proof or performance numbers. Existing five-locale SSR documents, initial content, schema and canonical metadata must remain intact.

## Interfaces and ownership
1. PAGE lane: components/home/home-experience.tsx, its test; new components/home/home-web3.module.css, lib/home-web3-copy.ts (+ test), optional components/home/home-section-nav.tsx (+ test). Keep exported HomeEntry type and HomeExperience({locale, entries}). Integrate HomeScene variant="hero" (parent adds prop), and HomeDiscovery({locale, entries}) (DISCOVERY lane). Keep data-home-section values and order hero-search/recent-content/usage-signals/pathways/editorial-trust for existing QA. Native ids home-top/home-latest/home-signals/home-pathways/home-editorial. Preserve link destinations, nofollow and genuine content. One h1 before scene in DOM. Use native anchor navigation; optional active section enhancement must never hide content or hijack scrolling. CSS modules scoped; no root theme/cookie changes.
2. DISCOVERY lane: new components/home/home-discovery.tsx, home-discovery.module.css, home-discovery.test.tsx, lib/home-discovery-copy.ts (+ test). Props locale: SeoRouteLocale; entries: readonly HomeEntry[] (type-only import). Render real entries in SSR with category badge and actual title/summary/href. Client category chips derived solely from entries; search within this visible recent set; clearly label that scope, exact filtered counts, no-results reset, deterministic next-pick preview linked to a genuine available record. No new fetch/auth/localStorage/DB. Must reset invalid filters and preview when props change. Treat Unicode reasonably (NFKC, case-insensitive). Avoid huge new feature or duplicate full-site search. Light editorial card deck with restrained orange/black accents, category graphic treatment visibly decorative not original media.
3. PARENT: add backward-compatible HomeScene variant="studio"|"hero" and tests. Default studio retains prior contract. Hero shell transparent, larger integrated stage, compact signal UI and accessible explanations, pause/reset + SVG fallbacks preserved; no need to mutate renderer or geometries. Verify all integration and browser behavior. Own QA scripts and release notes.

## Verification / task ledger
- [ ] PAGE red-green behavioral tests, translated copy, layout + anchors
- [ ] DISCOVERY red-green SSR/filter/count/reset/next-pick/empty/locale tests
- [ ] PARENT red-green hero variant and retained renderer interaction tests
- [ ] Review changed files and typecheck/scoped lint/full tests
- [ ] Run local preview on existing authorized dev server 3106 (do not stop existing 3105)
- [ ] Desktop/mobile visual inspection and keyboard/pointer/touch + 5-locale/3-width browser regression; initial SSR and no-WebGL usable
- [ ] Production build with read-only QA preload if reachable; never deploy loopback build
- [ ] Report exact evidence and limitations; leave local preview accessible

## Review focus
No search/CTA below a giant introductory demo; no double GPU canvases; no initial opacity-0 content/JS-only links; no carousel hiding full archive; no filter counts presented as entire corpus; no stale preview when filter/data changes; no decorative original-media provenance claims; no contrast losses in always-dark hero; no broken sticky offsets under global header; no removed reduced-motion controls; no broad modifications to unrelated pages.

## Official implementation references
https://threejs.org/manual/en/responsive.html
https://nextjs.org/docs/app/guides/lazy-loading
https://www.w3.org/TR/WCAG22/#animation-from-interactions
Also consult version-matched Next docs in node_modules/next/dist/docs before implementation.
