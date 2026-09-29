# SEO / GEO / publisher readiness — 2026-09-28

## Scope and operational boundary

Local source improvements in `/Users/toris/projects/memecatch` on the existing dirty main. Previous unified five-language homes, original Three.js artwork, safety icons, creator-market flows, and security changes remain. No Git commit, staging, push, deployment, hosted database/storage writes, AdSense settings changes, site removal/re-addition, review submission, support message, or Search Console submission was performed.

This release improves technical correctness, evidence presentation and editorial remediation. It does not certify copyright, predict Google approval, or guarantee indexing/AI citations. Existing moderation decisions and content-depth thresholds were not changed; thousands of corpus entries were not bulk rewritten or hidden.

## Account checks

Read-only AdSense recheck at 15:04 KST: `catchmeme.com` remains Getting ready / review in progress, ads.txt Authorized, no current refusal reason and no resubmission button. The table's July 27 11:14 KST date is approval-state last update; an earlier expanded review panel established the same review-request timestamp.

At 15:15 KST, AdSense Home said all steps were complete, including profile, ad setup and site connection. This does not reveal Google's internal reason for delay. The inspected Search Console login displayed its welcome page instead of a catchmeme property; sitemap submission/last read, index exclusions and manual actions could not be checked. No property was added or changed.

Google explicitly advises not removing and resubmitting a site while Getting ready because this can delay processing. Recommendation: retain the current application, deploy the reviewed improvements only after release prerequisites are resolved, and ask the account's official help/contact channel about the prolonged pending request. Only a later Requires review / Needs attention state with specific instructions warrants following that review workflow. No automatic review action is implemented.

Official guidance:
- https://support.google.com/adsense/answer/12170222?hl=en
- https://support.google.com/adsense/answer/12169212?hl=en
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- https://support.google.com/adsense/answer/10502938?hl=en

## Changes

### Search and machine-readable distribution

- Canonical helper and default/localized detail redirects consolidate short-only, wrong and stale slug paths without deriving redirect destinations from user-supplied URLs.
- RSS, root llms.txt and root llms-full.txt now share the existing `isIndexableMeme` gate. Their pre-existing approved-only export policy is preserved, while the sitemap/detail still support their approved/limited public policy. Limits apply after filtering; pagination uses a stable ID tie-breaker and an explicit scan bound.
- Failed export reads return 503 / Retry-After and no-store instead of a successful empty catalog or an invented `3,000+` count. A valid empty catalog remains distinguishable from an outage.
- Sitemap no longer timestamps unrelated pricing/policy/static pages with the latest meme or current request date. Only valid, actual stored modification dates are emitted where appropriate.
- Root llms files are optional readable exports, not a required AI-search mechanism. Google says no special AI text file or schema is necessary for its AI Search features.

### Evidence and structured data

- Public reference URLs reject executable, relative, credentialed, literal-IP, local/reserved and nonstandard-port addresses. Validation is syntax-only: no arbitrary URL fetching or assertion of reachability/ownership.
- Source identity normalizes hostname case and ignores document fragments without lowercasing case-sensitive paths or video IDs.
- Source collection timestamps are labeled collection records, not publication dates or completed fact checks. Invalid, impossible-calendar and future dates are omitted.
- Trust labels state that references are linked rather than certifying primary-source verification merely from a URL/title.
- WebPage JSON-LD citations contain only titled valid public sources also linked in the visible page; extra visible untitled/context links need not be asserted as structured citations.
- WebPage publication time no longer falls back to database creation time. VideoObject is omitted when no source-derived video upload date exists, rather than misusing meme creation time.

### Operator editorial remediation

New route: `/admin/publisher-readiness`, also linked from admin navigation.

- Operator check occurs before diagnostics queries; noindex, force-dynamic and read-only.
- Reads 100 public records per page in stable ID order; validated page bounds at route and reader boundaries.
- Distinguishes exact total public count, inspected page count, and filtered display count. Focus filters apply only within the inspected page, not the entire corpus.
- Detects absent valid public references, empty/repeated summaries, missing/impossible/future publication dates and insufficient original prose under existing internal depth rules.
- Provides edit, public-page and source-review links with concrete next steps. The existing editor has no publication-date field, so date remediation is explicitly a separate documented correction of MemeCatch's first-publication time, not the original video's/article's publication time.
- Errors are not presented as empty/approved states. No metric is labeled a Google approval probability or universal word-count requirement.

## Verification ledger

- Final parent full Vitest at 15:36 KST: **348 files / 2,463 tests passed**, four workers and 30s test timeout. Final TypeScript, scoped changed-file ESLint, and git diff whitespace checks also passed.
- Parent TypeScript and app/components/lib ESLint passed with zero errors and six existing image-element recommendations.
- Parent production-mode build passed with 96 static pages and the new admin route. Three existing special-route metadataBase warnings remain. The build used loopback SITE_URL via the read-only preload and is a QA artifact, not a deployable production bundle.
- Live ads.txt audit at 15:28 KST passed all seven requests (scheme/www/UA comparisons). No advertising JS was executed, and an audit UA does not establish Google's real crawler history.
- Initial production HTTP smoke failed with HTTP200 instead of308. Next can stream a meta-redirect from page-level permanentRedirect. The existing bounded public existence lookup in proxy.ts now canonicalizes document requests before streaming. QA was corrected to use raw document HTTP rather than Node fetch, which overwrites sec-fetch-mode as a CORS subrequest even when supplied a custom header. The 308 assertion was retained, not weakened; ordinary non-document RSC/prefetch requests still intentionally skip this lookup.
- Independent source/canonical review found a double-decoding edge case. A red regression reproduced it; the helper now explicitly distinguishes already-decoded Next page params from encoded proxy URL segments. Paths with literal percent signs remain valid, and double-encoded aliases are no longer treated as canonical by the page helper.
- Review adjudication: structured citations being a strict subset of visible references is intentional. Only titled citable sources become structured citations; visible untitled links may remain. No hidden citation or invented title was introduced.
- Final local production HTTP smoke: **11/11 checks passed**. Short-only/wrong-slug detail requests returned308; the canonical document and one reviewed English document returned200; an invalid meme returned404; the new admin desk redirected anonymous visitors to login with307. RSS/root llms exports returned200. Sitemap contained **1,032 unique URLs** and no invented privacy-page lastmod. Default detail structured citations matched the two visible titled references and emitted no fictional VideoObject. This is not Google indexation/approval evidence.
- The QA script stopped only its own local server. No signed-in production operator browser session or full real-device performance audit is claimed.

## Remaining release prerequisites

- Deploying the local source requires a new build. No prior Vercel artifact contains all these changes.
- Reconcile the existing AdSense code-snippet verification selection with verification-only ad runtime defaults before deploying; a meta tag in source alone does not change the account's selected method. Keep real ads disabled during QA and verify consent/page exclusions before enabling.
- Keep the prior legacy migration prerequisites in view (including the missing hosted `reserve_api_request(text)`); do not blindly push historical migrations.
- Actually improve the flagged corpus using source-backed original explanations. A diagnostic screen does not fix the previously observed missing-source/placeholder records, and noindex alone is not an AdSense policy remedy.
- Search Console performance/exclusion diagnosis remains unavailable in the inspected login.

## Support-request draft (not sent)

catchmeme.com의 사이트 검토가 장기간 ‘준비 중 / 광고 게재 가능 여부 검토 중’으로 표시됩니다. 기존 검토 요청은 2026년 7월 27일 11:14 KST이며, 2026년 9월 28일 재확인 시 ads.txt는 ‘승인됨’이고 AdSense 홈은 ‘모든 단계를 완료했습니다’라고 표시합니다. 현재 구체적인 반려 사유나 재심사 버튼은 없습니다. 사이트는 삭제·재등록하지 않았습니다. 현재 검토 진행 상태와 추가로 필요한 조치가 있는지 확인 부탁드립니다.
