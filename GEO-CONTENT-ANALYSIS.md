# GEO Content Quality & E-E-A-T Analysis — catchmeme.com

**Date:** 2026-07-11 (재감사) · 1차 감사: 2026-07-10 (43/100)
**감사 방식:** geo-content 전문 에이전트(sonnet) 프로덕션 실사 + 소스 대조

## Content Score: 47/100 (재감사 시점) → 개선분 반영 배포 후 예상 60대

## E-E-A-T Breakdown (재감사 시점)

| Dimension | Score | Key Finding |
|---|---|---|
| Experience | 8/25 | 유래 서술이 9~15단어 팩트 나열 — 확산 경로·계기 부재 |
| Expertise | 6/25 | 저자성 없음("검수팀" 일반명칭), 방법론 서술 부족 |
| Authoritativeness | 7/25 | 외부 인용 0, 나무위키 단일 출처 의존 |
| Trustworthiness | 14/25 | 정책 문서·푸터·광고 고지는 갖춰짐, 출처·날짜 UI 미노출(당시) |
| Topical Authority Modifier | +7 | 허브 10종 + 3,115건 — Developing~Authority 사이 |

## 재감사 발견 → 이번에 반영한 수정

| 심각도 | 발견 | 조치 |
|---|---|---|
| CRITICAL | 임베드 있는 상세 페이지에서 출처 링크 미렌더 | 유래 섹션 아래 **상시 출처 블록**(임베드 여부 무관, meme_sources 기반, 최대 3개) 배포 |
| HIGH | 작성/수정일이 UI에 미노출 (스키마에만 존재) | "밈캐치 검수팀 확인 · 마지막 업데이트 {날짜}" `<time>` 블록 |
| HIGH | /submit 검수 절차 비가시 | "제보 → 사실 확인 → 저작권 확인 → 공개" 스텝 UI |
| **HIGH** | **유래(origin) 깊이 — 샘플 전건 9~15단어** | **상위 147건을 48~78단어로 재집필** (웹검색 사실 검증, 5배치 sonnet 워크플로, "~로 알려져 있다" 불확실성 표기 원칙) — 원격·로컬 반영 완료 |
| MEDIUM | 나무위키 단일 출처 의존 | 재집필 과정에서 **비-나무위키 보강 출처 97건**(뉴스·원본 영상·공식 게시물) meme_sources 추가 |
| MEDIUM | 운영자 배경·큐레이션 기준 서술 부재 | /about에 "큐레이션 기준" 섹션(정의 독립성·유래 특정·불확실성 표기 원칙) + 운영자 서술 보강 — 허위 이력 없이 사실 기반 |
| LOW | 스트리머·게임 밈 허브 부재 (콘텐츠 갭) | `/collections/streamer`·`/collections/game` 신설 (keyword 필터 신설, 각 24개 카드) — supabase-js `.or()` `%` 인코딩 버그 수정(`*` 문법) |

## 미반영 (관찰/운영 항목)

- **sitemap lastmod 동일 타임스탬프** — 일괄 백필 흔적. 운영하며 실편집 시 개별 갱신되는지 스팟체크 (모니터링)
- **/submit 비로그인 리다이렉트로 검수 안내 미노출** — 전역 푸터가 대체 노출 중. 인증 구조 변경은 별도 결정 필요
- **개인 저자 스키마(Person)** — 1인 운영 특성상 실명 공개 부담. /about 서술로 부분 대체
- 유래 보강은 상위 150건 우선 — 나머지 ~2,900건은 조회 상위부터 순차 확장 권장 (동일 워크플로 재실행 가능: `data/memes/origin-enrich-147.json` 참조)

## Page-by-Page (재감사 시점)

| Page | Words | Citability |
|---|---|---|
| / | ~900 | Low-medium |
| /about | ~650 | **High** (정책·프로세스 인용 가능) |
| /collections/* | ~800 | Medium |
| /memes/* (보강 전) | 150~380 | Medium (보강 후 유래 +50단어씩 상승 예상) |
| /privacy·/terms | ~600 | Medium (신뢰 문서) |
| /community | UGC | Low (권위 신호 아님 — 정상) |

## 다음 측정

개선분이 프로덕션 배포된 후(PR 머지 + ISR 갱신) `/geo compare`로 델타 측정 권장. 예상 개선 축: Experience(유래 깊이·확산 경로), Trustworthiness(출처·날짜 상시 노출), Topical Authority(허브 12종).
