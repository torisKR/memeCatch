# Unified Home, Original 3D Signals, and AdSense Readiness — 2026-09-28

## Scope and deployment boundary

Implemented in the original `/Users/toris/projects/memecatch` checkout on `main`. Existing uncommitted integrations, canonical/hreflang metadata, creator-market changes and security work were preserved. No commit, push, deployment, hosted migration, content mutation or Google account setting change was performed. Previous Vercel deployments do not include this work and must not be described as this release.

## Experience

- One `HomeExperience` layout for Korean, English, Japanese, Simplified Chinese and Traditional Chinese: hero/search → recent editorial content → usage signals → community/products paths → editorial information.
- Actual published/eligible localized records only. Translation-empty and connection-error states do not manufacture translated content or assert an empty archive as fact.
- Korean recent content is ordered by publication timestamp, not the meme's origin year or an invented popularity score. Localized Explore now applies `sort=recent` before limiting candidates, preserving default trend ordering otherwise.
- The global and Korean home now have the same components and hierarchy, while copy and available content remain language-specific.
- URL locale takes precedence over a stale cookie; canonical root and `/index` are Korean. Shared non-home pages retain preference-cookie behavior. Traditional Chinese menu/trend labels and navigation accessible names were corrected.

## Original design assets

- `components/home/home-scene-renderer.ts`: original Three.js geometry, beveled speech-card sculpture, orbital frame and four distinct modeled signal tokens. No external stock model or texture download.
- `components/home/home-scene-fallback.tsx`: original server-rendered SVG representation for non-WebGL/failure contexts.
- `components/home/home-scene.tsx`: lazy GPU enhancement, max DPR 1.5, low-power renderer, pause/resume, tab/offscreen suspension, reduced-motion behavior and clean disposal. Initialization exceptions and context loss return to the vector fallback.
- `components/safety-icon.tsx`: four original SVG glyphs, used in the status badge/guide and homepage cards. Korean labels remain 써도 됨 / 맥락 주의 / 이미 늦음 / 쓰면 위험.
- `components/safety-legend.tsx` and `lib/safety-copy.ts`: color-independent shapes, labels, native keyboard-operable details and five-language explanations.
- Usage-context rows retain the original work/friends/family/SNS meaning and actual grades. A green social-use grade no longer implies brand or advertising permission. No legal permission or universal safety guarantee is asserted.

## AdSense changes and findings

See `docs/releases/2026-09-28-adsense-diagnostic.md` for full observed evidence and a support-request draft.

- Public `ads.txt` currently works: HTTP 200, text/plain, verified publisher `pub-3004906966180197`; all four scheme/host variants and three user-agent comparison requests succeeded.
- A historical incorrect publisher ID was fixed in Git on September 21. That fact does not independently explain Google's current Not found label.
- Fresh authenticated console inspection at **2026-09-28 14:39 KST** shows **ads.txt Authorized (`승인됨`)**, superseding the earlier Not found observation. Site approval remains preparing/review requested, not an observed fresh rejection. The review request is dated July 27, 2026, 11:14 KST. No last actual ads.txt crawl date or current specific rejection reason was displayed; Policy Center showed no current violations. No application deployment or account mutation caused by this task was performed during that status change.
- No Check for updates button was offered during the pending review, so no recrawl request was submitted. No review request, site removal/re-addition, ad interaction or support message was sent.
- New Auto Ads runtime defaults OFF unless the server-side `ADSENSE_AUTO_ADS_ENABLED` opt-in is explicitly set to `true`. Ownership verification metadata and ads.txt remain. Before enabling, confirm the account's accepted verification method, approval, consent and page-exclusion strategy. An executed Auto Ads runtime can survive SPA navigation; route-level component removal alone does not stop it.
- Production origin/client validation prevents local or preview QA from loading real ads. Quiz, community and promotional-product routes no longer instantiate an ad loader; approved substantial sourced details are eligible only after the explicit runtime opt-in.
- Public-record diagnostics found 1,786 records without a source URL and 462 title-equals-summary records out of 4,378. These are internal editorial concerns, not Google's stated rejection reason or minimum-word rules. They were not bulk-deleted or mass-rewritten.

## Verification evidence

Fresh parent verification on Node 24.16.0:

- Fresh full Vitest recheck after the selector refinement on 2026-09-28 at 14:35 KST: **340 files / 2,359 tests passed** (`pnpm exec vitest run --maxWorkers=4 --testTimeout=30000`, Node 24.16.0). The earlier pre-refinement run was 2,348 tests.
- Fresh read-only HTTP recheck at 14:34 KST: all seven ads.txt checks passed with HTTP 200, text/plain and publisher pub-3004906966180197. Read-only production counts were reconfirmed at 14:36 KST: 4,378 public records, 1,786 without a source URL and 462 with identical title/summary. These are not Google-supplied rejection reasons.
- TypeScript: passed.
- AdSense HTTP-audit tests: **4/4 passed**.
- App/core ESLint: **0 errors**, six existing image-element recommendations.
- Production-mode Next build: **passed**, 96 static pages generated. Three pre-existing metadataBase warnings on special routes remain; the QA build used a loopback site URL and is not a deployable artifact.
- Git diff whitespace checks passed; no staged files.

Fresh-profile Chrome checks rerun after the selector refinement against a newly rebuilt local production-mode server, with remote writes and ad traffic blocked (the temporary server and browser were stopped after the run):

- All **15 combinations** of ko/en/ja/zh/zh-tw × 375/768/1440 CSS pixels loaded with the correct language, identical five-section order, four signal controls, no horizontal overflow, no broken images and no AdSense runtime.
- A stale zh-tw cookie did not replace Korean at `/?lang=ko`; the real selector changed to an English home with matching document/header/body language.
- Actual WebGL draw-call instrumentation confirmed animation playing, explicit pause, resume, reduced-motion pause and resume after disabling the preference. This is stronger than observing only a canvas or a button label.
- Deliberate WebGL context loss on the disposable QA canvas removed the canvas and retained the original SVG fallback.
- No captured JavaScript exceptions.
- Native visual inspection confirmed clean mobile/tablet/desktop composition and legible artwork. The first screenshot set contained transient missing-control impressions; cold-navigation retakes disproved them and showed the English mobile header icons and dark-mode search label correctly.
- This is not full WCAG certification, a real-device GPU/performance benchmark, or a signed-in seller/moderator E2E claim.

### Browser artifacts (local machine, temporary output)

Full run:
`/var/folders/1k/hsqljbyj4c9_ky4dsfh26k1r0000gn/T/memecatch-home-qa-I98Wro/report.json`

Screenshots in the same directory include `ko-375.png`, `en-375.png`, `ko-768.png`, `ko-1440.png`, `dark-reduced-motion.png`, and `context-loss-fallback.png`.

Cold-navigation retakes:
`/var/folders/1k/hsqljbyj4c9_ky4dsfh26k1r0000gn/T/memecatch-home-qa-ldh96V/`

Reproduce with a local-only server at port 3105:

```sh
node scripts/qa-unified-home.mjs
node scripts/audit-adsense-readiness.mjs
```

The browser script creates a fresh temporary Chrome profile and screenshots outside the checkout, never uses user credentials, blocks ad-network requests, and closes its own browser. A server-side remote-write blocker must remain enabled while testing against production-readable data.

## Remaining operational work

This source must be deployed in a new build to change the public site. Keep the known legacy migration prerequisites from the previous integration report in view; do not blindly push historical migrations. The ownership panel currently displays AdSense code snippet selected: before deploying the default verification-only runtime, confirm Google accepts the meta-tag/ads.txt method or retain the required snippet with appropriate exclusions. No verification selection has been changed. **The console now shows ads.txt Authorized; site approval is still pending.** No site-approval guarantee, request resubmission, or production deployment is claimed.
