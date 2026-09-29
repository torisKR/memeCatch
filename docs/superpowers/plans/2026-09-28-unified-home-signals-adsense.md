# Unified Home, Original 3D Assets, and AdSense Diagnostics

## User goal
Renew the original MemeCatch checkout so Korean and global home pages have the same usable structure, custom Three.js artwork, and four original usage-signal icons. Investigate ads.txt and repeated AdSense rejection using actual evidence, not an approval guarantee.

## Constraints and decisions
- Work in /Users/toris/projects/memecatch on its current main checkout. Preserve all existing uncommitted integration, metadata, security, and navigation changes. No reset, stash, indiscriminate copying, push, deployment, or database mutations.
- Same home layout/section order for ko/en/ja/zh/zh-tw; locale chooses copy, working links, and genuinely published localized records. Do not masquerade unreviewed translations as approved or fabricate trend rankings.
- Visual direction: warm editorial cream and flame orange, existing Pretendard typography, an original sculptural signal-catcher made from rounded 3D speech cards, orbital frames, and four status tokens. Keep content/search primary, avoid full-screen canvas or WebGL-only navigation.
- Three.js is expressly requested. Parent owns installing pinned three@0.186.1 and @types/three@0.186.0; no extra rendering framework.
- GPU artwork is progressive enhancement with server-rendered original SVG fallback, bounded DPR, off-screen/tab suspension, reduced-motion/save-data behavior, explicit pause/resume control, context-loss fallback, and disposal.
- Usage signals describe editorial context, not legal permission or a guaranteed real-time safety verdict. Preserve labels: 써도 됨, 맥락 주의, 이미 늦음, 쓰면 위험. Original check/speech-warning/clock/stop icon system; preserve textual equivalents for text-only exports.
- Do not load real advertising or create traffic against advertisements during local QA. Do not click ads, request review prematurely, or weaken authentication/crawler security.
- AdSense audit must distinguish live ads.txt delivery, publisher identity, crawlability, account status, content quality, and actual console rejection evidence. Prior production promotion was security-blocked: no bypass attempts.

## Work lanes and interfaces
1. Home integration lane: components/home/home-experience.tsx, lib/home-copy.ts, app/(default)/page.tsx, app/[locale]/page.tsx, related home tests. Reuse shared HomeScene and SafetySignalGuide interfaces below. Own no package/lock, ad-loader, proxy, or shared safety files. One shared layout with hero/search, recent content, usage-guide, community/product pathways, editorial trust/footer links, and honest empty states.
2. 3D lane: components/home/home-scene.tsx plus dedicated scene renderer and fallback files/tests. Export HomeScene({className?, label?, pauseLabel?, playLabel?}). Original local geometry, SVG fallback from React, no external models/fonts/textures. Never alter home page routes or package files.
3. Signal lane: components/safety-icon.tsx, components/safety-legend.tsx, lib/safety-copy.ts, components/safety-badge.tsx, components/usage-guide.tsx and dedicated tests; targeted localized badge propagation if needed, not home files. Export SafetyIcon({level, className?, title?}) and SafetySignalGuide({locale?}) with locale type from lib/i18n. SafetyBadge keeps existing required props and accepts optional locale. Existing text exports keep their symbols.
4. Parent AdSense lane: inspect live HTTP/http/www/bot/robots responses and actual notices; test/repair crawler routing and advertising placement/runtime gates only when evidence supports it. Create reproducible read-only audit tooling and release notes. No claim to have corrected an unobserved dashboard state.

## Verification
- Focused regression tests written and failed before behavioral fixes.
- Test shared section order and corresponding destinations across all five home locales, one h1, canonical/hreflang preservation, SSR meaningful content, no hidden translation claims.
- Test icons have distinct paths, accessible names/decorative semantics, color-independent shapes, labels and explanations; keyboard/touch reachability.
- Test renderer lifecycle/fallback behavior; browser check WebGL and no-WebGL, reduced-motion, dark mode, 375/768/1440 widths, locale switching, custom artwork rendering, no horizontal overflow.
- Run full Vitest with bounded workers, TypeScript, scoped/app ESLint, production build, read-only HTTP diagnostics and browser smoke. Record environmental/permission gaps without converting them into product success.
- Finish with changed files, evidence, remaining operational blockers, and no guarantee of AdSense approval.
