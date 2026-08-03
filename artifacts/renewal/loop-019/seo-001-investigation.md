# SEO-001 — soft-404 한정 조사 (루프 019)

## 실험 결과

| 요청 | 상태 |
| --- | ---: |
| `/qqqq` (라우터 수준 미존재) | **404** ✓ |
| `/memes/zzzzzzzz` (세그먼트 notFound) | **200** ✗ |
| `/memes/uefmryky` (정상) | 200 ✓ |

라우터 수준 404는 정상이다. 문제는 `/memes/[key]`처럼 **ISR(revalidate=600) 세그먼트
안에서 notFound()를 던질 때만** 200 + not-found UI가 나가고 그 200이 ISR 캐시에
저장된다는 것(`x-nextjs-prerender: 1`). generateMetadata·페이지 본문 양쪽에서
notFound()를 호출해도 동일하다.

환경 요인: `next.config.ts`의 `experimental.globalNotFound: true`
(다중 root layout 때문에 필요) + ISR 조합. Next 16.2.10.

## 가능한 해결책 — 전부 비용이 있다 (HG-007)

| 안 | 내용 | 비용 |
| --- | --- | --- |
| A | `/memes/[key]`를 `force-dynamic`으로 | ISR 캐시 상실 — 상세 전체가 매 요청 SSR. LCP·DB 부하 직접 영향 |
| B | Next 패치 업그레이드 후 재검 | 동작 변화 범위를 예측 불가. 검증 비용 |
| C | proxy에서 미존재 short_id를 선제 404 | proxy가 DB를 조회해야 함 — 모든 상세 요청에 지연 추가 |
| D | 현상 유지 + robots의 noindex 의존 | soft-404 잔존. 색인 오염 위험 지속 |

권장: B를 다음 정기 업그레이드에서 확인하고, 그전까지 D. A·C는 성능 비용이
결함보다 크다. 이 트레이드오프 확정은 성능·인프라 비용 결정이라 HG-007로 올린다.
