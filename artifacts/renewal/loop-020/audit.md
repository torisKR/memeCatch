# 루프 020 — 기준선 감사 잔여 항목 (§3 route · §5 홈 · §6 zero-result · 200% reflow)

## zero-result (§6) — 대체로 양호, 오타 후보만 없음
`/search?q=zzqqxxnonexistent` →
「아직 미포착 / 이 밈, 저희도 아직 몰라요 / '{q}' 제보하기」 + 오늘의 급상승 폴백 목록.
- 제보 CTA ✓ · 대체 콘텐츠 ✓ · **오타 후보("혹시 …를 찾으셨나요") ✗** → SRCH-001
- 참고: search_memes RPC에 pg_trgm similarity가 이미 있어 제안 쿼리 재료는 존재

## 홈 (§5) — 검색 최우선 ✓, 예시 검색어 ✗
- 검색 input이 콘텐츠 최상단(HTML pos 8537 < 랭킹 17095 < 오늘 22543) ✓
- 검색 버튼이 bg-accent-strong(루프 011 반영) ✓
- placeholder만 있고 **예시 검색어 없음** → HOME-001 (루프 021에서 구현)

## /submit (§3) — 로그인 게이트
307 → /login?next=/submit. flags.submissionsOpen 하의 의도된 동작.
주의: 상세의 「출처를 아시면 알려 주세요」 CTA(루프 003)가 비로그인 사용자에겐
로그인 벽으로 이어진다 — 제보 퍼널 손실 가능. 측정은 HG-006(ANL-001) 결정 후에.

## 200% 확대 프록시 — WCAG 1.4.10 reflow
640×800(1280의 200%)에서 홈·상세 모두 scrollWidth == innerWidth, 가로 오버플로 없음 ✓
=== LOOP 020-021 verify ===
      Tests  645 passed (645)
   Start at  01:31:53
   Duration  3.10s (transform 4.72s, setup 0ms, import 12.23s, tests 3.95s, environment 15.62s)

✖ 5 problems (0 errors, 5 warnings)

tsc ok
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand

