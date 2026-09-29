# SEO, GEO and Publisher Readiness Implementation Plan

> Execute bounded source fixes in the original checkout; use focused parallel workers with test-first changes and a final independent review.

## Goal / spec
Improve discoverability and citation readiness of real MemeCatch content and provide an actionable operator workflow for editorial issues before another AdSense review. The user asks whether to resubmit and authorizes local SEO/GEO/features/QA, not destructive Google account changes or automatic content publication.

## Constraints
- Work in /Users/toris/projects/memecatch on existing dirty main. Preserve all previous Three.js, unified locale home, creator-market, security, metadata and tests. No reset, stash, staging, commits, pushes, deployment, hosted SQL/storage changes or Google review/settings operations.
- SEO and AI search must receive the same useful visible content as people. No hidden text, fake authors/dates/reviews, keyword stuffing or guarantees of approval/ranking. llms.txt is optional interoperability, not a Google eligibility requirement.
- Keep existing content-depth thresholds and moderation decisions. Do not bulk-delete, unpublish, rewrite or automatically certify weak records.
- Reuse existing requireOperatorPage, contentDepth/isIndexableMeme, locale helpers and database readers. No added dependency or schema migration.
- Ads runtime remains fail-closed and separate from ownership verification. Keep verified publisher and ads.txt unchanged.
- Latest account read (15:04 KST): Getting ready; ads.txt Authorized; no fresh rejection/re-review button. July 27 11:14 table timestamp is approval-state updated time; earlier expanded review panel established the same request timestamp.

## Task 1 — technical publication consistency
Files: app/sitemap.ts/tests, app/feed.xml and llms routes/tests; limited metadata special routes when proven necessary. Read installed Next metadata docs first. Auditor must identify exact inconsistency and add red tests before fixing. Ensure honest dates, canonical URLs, genuine current reviewed translations, stable pagination, safe escaping, useful failure semantics. Do not change shared depth thresholds. Do not edit detail-page/JSON-LD files (Task 3 owner).

## Task 2 — operator editorial readiness desk
Files: new lib/publisher-readiness.ts/test; lib/publisher-readiness.server.ts/test; app/(default)/admin/publisher-readiness/page.tsx/test; components/admin/admin-nav.tsx/test only.
Implement operator-only, noindex, read-only paging of published approved/limited records (100/page; bounded validated page parameter and stable id order). Every record links to existing edit/public/source workflows. Classify source gaps, title=summary placeholders, missing publication date, insufficient original content using existing depth signals. Display inspected-page counts vs total public count distinctly; optional focus filtering explicitly only within page. Classifier emits actionable explanations and does not call anything Google-approved. Source links must be actual public HTTP(S), credentials/private hosts rejected; never fetch arbitrary URLs. Include account review instructions as manual operational checks, not live state claims. Errors must not be displayed as empty/pass. Tests: anonymous and non-operator denied before queries; proper bounds/order; sample vs total; no write operations; adverse text/dates/urls; HTML escaping.

## Task 3 — truthful visible citation/provenance (parent)
Inspect existing source-evidence/trust-note and structured data on Korean/localized detail. Add one reusable source/citation normalization helper and visible evidence context where needed, without duplicating existing sections. Evidence count is not independent fact-check verification. Only real stored valid dates and references are emitted; never use request/build time as publication date. Wire structured citation URLs only if they appear in visible content. Preserve language-specific UX and noindex semantics. Test unsafe links, empty evidence, Unicode/JSON escaping, absent/future dates, canonical cite targets and user-visible parity.

## Review focus / verification
- Failed source reads must fail explicitly, not become a valid empty sitemap/dashboard.
- Metadata must not invent publication/review dates or assert independent verification from source count.
- Existing unreviewed/stale translations must not be advertised as reviewed or indexable.
- Private editorial diagnostics must never leak through public routes or metadata.
- Existing protected routes and ad opt-in remain intact.
Run focused red/green tests, full Vitest (4 workers), TypeScript, scoped ESLint, production-mode build under existing read-only local QA preload; inspect representative Korean/global detail, sitemap/feed and anonymous admin guard. Recheck actual public ads.txt without executing advertisements. Record changes, exact test results, remaining editorial corpus work and pending deployment separately.

## Progress
- [x] Source/context and current official Google guidelines read.
- [x] Account read-only recheck: still pending; ads.txt Authorized; no resubmission action performed.
- [ ] Technical fixes with regression tests.
- [ ] Operator readiness desk with tests.
- [ ] Citation/provenance consistency with tests.
- [ ] Independent review, final tests/build, documentation.
