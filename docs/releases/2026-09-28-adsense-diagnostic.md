# AdSense diagnostic — 2026-09-28

## Verified findings

- Site: `catchmeme.com`.
- Verified publisher: `pub-3004906966180197`.
- Live `https://catchmeme.com/ads.txt` returns HTTP 200, `text/plain; charset=utf-8`, and `google.com, pub-3004906966180197, DIRECT, f08c47fec0942fa0`.
- HTTP apex, HTTPS www, and HTTP www all resolve to the same HTTPS apex content (1, 1, and 2 redirects respectively). Direct HTTPS apex has no redirect.
- Comparison requests bearing Mediapartners-Google, AdsBot-Google, and Googlebot user-agent strings returned HTTP 200. This does NOT verify Google's network access, IP ranges, internal fetch history, or last actual crawl.
- Public robots.txt does not disallow `/ads.txt`. Application proxy excludes `.txt`; locale routing does not intercept this path.
- Commit `d70afcd63a6626c181e49c328035808e96b99f98`, dated 2026-09-21 18:55 KST, replaced an incorrect publisher ID with the current verified ID. The earlier ID mismatch is proven by Git history. It does not establish why Google's current status specifically says Not found rather than Unauthorized.

## Current account evidence — refreshed at 2026-09-28 14:39 KST

Re-inspected the already-authenticated AdSense Sites detail and Policy Center without changing account settings (Aside session `T4ApxapMKAsuLmXP`):

- Site approval status: `준비 중`.
- Detail: `광고 게재 가능 여부 검토 중` and `리뷰가 요청됨`.
- Review requested: **2026-07-27 11:14 KST**. The on-screen tooltip confirms that the table's last-updated date is the approval-status update time, **not the ads.txt last-crawled time**.
- **ads.txt status is now `승인됨` (Authorized).** The earlier same-day observation of `찾을 수 없음` is superseded. The tooltip defines Authorized as having found the publisher ID in the site's ads.txt file. The actual last crawl date remains undisclosed.
- No specific current rejection reason displayed. A prior rejection notification does not mean the current status is rejected.
- Policy Center: `현재 정책 위반 문제 없음`. This does not certify that a still-pending site has passed its approval review.
- The ownership section displayed the AdSense code snippet radio option checked. No verification option was changed. Before deploying the verification-only runtime default, reconcile the account's verification method: confirm acceptance of the existing meta tag/ads.txt method or retain the required snippet with appropriate ad exclusions. Do not assume merely adding a meta tag changes the account's selected verification method.
- A separate address-verification payment hold is present; it is not evidence of an ads.txt delivery failure or a current ad-serving policy suspension.
- No Check for updates button was displayed. No recrawl, new review, site removal/re-addition, support message or account setting change was performed.
- No application deployment was performed during this recheck. Do not attribute Google's status change to these unshipped source changes.

Account screenshot evidence is on the user's Mac under `/Users/toris/.aside/u/0/sessions/2026-09-28_T4ApxapMKAsuLmXP/tmp/`: `adsense-catchmeme-status.png` and `adsense-policy-center.png`.

Account detail: https://adsense.google.com/adsense/u/1/pub-3004906966180197/sites/detail/url=catchmeme.com

## Editorial risk assessment (not Google's stated rejection cause)

Read-only production aggregate on public approved/limited records:

| Check | Count |
| --- | ---: |
| Public records | 4,378 |
| Description under 150 characters | 3,249 |
| Description under 40 characters | 442 |
| Title equals summary | 462 |
| No recorded publication timestamp | 462 |
| No linked source URL | 1,786 |

These are diagnostic fields, not Google's minimum word count or automatic approval criteria. Other content fields may add substance. Missing source URLs, placeholder summaries, incomplete entries, and reused media without substantive original explanation remain risks worth editorial review. No bulk deletion/unpublishing or fabricated rewriting was performed.

## Code improvements in the original checkout

- One shared, original editorial home layout for ko/en/ja/zh/zh-tw, with accessible original Three.js/SVG art and clear navigation; no claim that decoration earns approval.
- Ad script requires the verified publisher identity and a production runtime. Local, preview, unverified domains, spoof domains, credentials and nonstandard ports fail closed.
- Server-rendered ownership metadata remains available independently of the ad runtime.
- Removed new Auto Ads loader calls from promotional products, the quiz and unreviewed community pages.
- Detail ad loading additionally requires approved status, distinct nonempty title/summary, substantive editorial content, and at least one source. This is an internal conservative gate, not a copyright grant or Google certification.
- A loaded third-party Auto Ads runtime may survive client-side navigation; loader placement alone is not a complete guarantee of per-route ad exclusion. The updated code therefore defaults to verification-only mode: `ADSENSE_AUTO_ADS_ENABLED` must explicitly equal `true` to start Auto Ads, even on the verified production host. `.env.example` documents `false`; no actual environment or account setting was changed. Keep it disabled until approval, consent and account-side page exclusions (or a controlled manual-unit strategy) are reviewed. Google documents the server-rendered `google-adsense-account` meta tag as a verification option independent of loading the ad script; this task did not change the account's selected verification method or request another review.
- Added `scripts/audit-adsense-readiness.mjs` and tests. The CLI performs seven fixed, read-only HTTP checks, does not execute ad JavaScript, and cannot modify Google status.

## Next operational action

The ads.txt issue is no longer shown: leave the currently Authorized file intact. The remaining account issue is the pending July 27 site review. Use the account's official Help/Contact or publisher help channel to ask for investigation of that pending review, clearly distinguishing it from the now-Authorized ads.txt status. Do not remove/re-add the site or manufacture ad requests. Review the independent editorial risks above and the current code-snippet verification selection before deploying. No support message has been sent by this task.

### Support request draft

> catchmeme.com의 사이트 심사가 2026년 7월 27일 11:14 KST 요청 이후 ‘준비 중 / 광고 게재 가능 여부 검토 중’으로 표시됩니다. 2026년 9월 28일 14:39 KST 재확인 시 ads.txt 상태는 ‘승인됨’이며, https://catchmeme.com/ads.txt는 HTTP 200, text/plain으로 게시자 ID pub-3004906966180197의 올바른 레코드를 제공합니다. 정책 센터에는 현재 위반 문제가 없고 구체적인 사이트 반려 사유는 표시되지 않습니다. ads.txt 확인과 별개로 장기간 대기 중인 사이트 심사의 상태와 필요한 후속 조치를 확인해 주세요.

## Official references

- https://support.google.com/adsense/answer/12169212?hl=en (verification options and review workflow)
- https://support.google.com/adsense/answer/12171612?hl=en
- https://support.google.com/adsense/answer/7679060?hl=en
- https://support.google.com/adsense/answer/10502938?hl=ko
- https://support.google.com/adsense/answer/48182?hl=en

Google's final review decision remains separate from this code change and diagnostic.
