# GEO Audit Report: 밈캐치 (MemeCatch)

**Audit Date:** 2026-07-10
**URL:** https://memecatch.vercel.app
**Business Type:** Publisher (사전형 콘텐츠) + 커뮤니티 하이브리드
**Pages Analyzed:** 홈 · 밈 상세 ×5 · /explore · /community(+상세) · /rankings · robots/sitemap/llms/feed
**감사 방식:** 전문 서브에이전트 5개 병렬(AI가시성·기술·콘텐츠 E-E-A-T·스키마·플랫폼) + 원시 HTML(curl, JS 미실행) 교차 검증

---

## Executive Summary

**Overall GEO Score: 48/100 (Poor) → 수정 반영 후 예상 ~65 (Fair)**

기술 기반(SSR 완전 렌더, robots 전면 허용, 3,116 URL 사이트맵, DefinedTerm 스키마)은 탄탄하지만,
**신뢰 문서 전무(개인정보처리방침·약관·소개·푸터 404)**, **스키마 커버리지 25점**, **브랜드 외부 언급 0건**이
점수를 끌어내렸다. 이번 감사에서 발견 즉시 수정 가능한 항목(아래 "이번에 수정 완료")은 모두 코드로 반영했다.

### Score Breakdown (감사 시점)

| Category | Score | Weight | Weighted |
|---|---|---|---|
| AI Citability | 76/100 | 25% | 19.0 |
| Brand Authority | 3/100 | 20% | 0.6 |
| Content E-E-A-T | 43/100 | 20% | 8.6 |
| Technical GEO | 78/100 | 15% | 11.7 |
| Schema & Structured Data | 25/100 | 10% | 2.5 |
| Platform Optimization | 58/100 | 10% | 5.8 |
| **Overall** | | | **48/100** |

---

## 이번에 수정 완료 ✅ (2026-07-10, 동일 브랜치 반영)

| 심각도 | 이슈 | 수정 |
|---|---|---|
| Critical | SSR HTML에 "0개 수록" 노출 (AI 크롤러에겐 빈 사전) | CountUp이 서버 렌더에 실제값(3,115) 포함, 애니메이션은 마운트 후만 |
| Critical | /privacy·/terms·/about 404 + 푸터 전무 (법적 리스크) | 3개 페이지 신설 + 전역 푸터(운영·문의·정책 링크·저작권 안내) |
| Critical | Organization 스키마·sameAs 전무 | `OrganizationJsonLd`(로고·이메일·GitHub sameAs) 전 페이지 렌더 |
| High | llms.txt 404 | `/llms.txt` 동적 라우트(서비스 설명·카테고리·실시간 인기 밈 15·인용 안내) |
| High | canonical 전 사이트 부재 | 루트 `/` + 상세(`memePathFrom`) + explore/rankings/about/privacy/terms |
| High | 홈 og:image 부재 → 트위터 카드 격하·카카오 미리보기 빈약 | 루트 `opengraph-image.tsx`(1200×630 브랜드 카드) |
| High | DefinedTerm에 날짜 신호 없음 | `WebPage` 래퍼(datePublished/dateModified/speakable) + mainEntity DefinedTerm |
| High | BreadcrumbList 부재 | 상세 페이지 홈›카테고리›밈 3단 |
| High | VideoObject 부재(유튜브 임베드 662건 미활용) | 대표 유튜브 임베드 존재 시 VideoObject 렌더 |
| Medium | DefinedTermSet 실체 없음(참조 대상 부재) | 홈에 `#glossary` @id 선언, 상세가 @id 참조 |
| Medium | /explore·/rankings 스키마 0건 | CollectionPage + ItemList(top10) |
| Medium | 보안 헤더 부재 | X-Content-Type-Options·X-Frame-Options·Referrer-Policy·Permissions-Policy |
| Medium | sitemap 홈 lastmod가 빌드 시각 | 최신 밈 published_at 기준 + 정적 페이지 6종 추가 |
| Low | 커뮤니티 글 스키마 없음 | DiscussionForumPosting(작성자·좋아요·댓글수) |
| Low | 폰트 CDN preconnect 없음 | preconnect 추가 |
| Low | 검수 프로세스 비가시 | /about에 4단계 검수 흐름 명시 + 푸터 요약 |

## 남은 항목 (운영/외부 작업 — 코드로 해결 불가)

| 심각도 | 이슈 | 실행 방법 |
|---|---|---|
| **Critical** | **네이버 서치어드바이저 미등록** | searchadvisor.naver.com에서 사이트 등록 → 소유확인 메타태그를 받아 알려주시면 코드 반영. sitemap·RSS 제출 |
| High | 브랜드 외부 언급 0건 (AI 엔티티 인지 불가) | ① 나무위키 서비스 문서 + 기존 밈 문서 외부링크 역참조 ② r/korea 등 밈 질문 스레드 진정성 답변 ③ 디시·에펨코리아 발원 스레드 출처 코멘트 ④ 유튜브 쇼츠 채널 |
| High | sitemap 3,115건 lastmod 동일(일괄 시드 흔적) | 운영하며 실편집 시에만 updated_at 갱신 — 자연 해소. 필요시 시드 시점 분산 백필 |
| Medium | 커뮤니티 초기 활성도(0 좋아요 노출) | 초기 시딩 상호작용 또는 지표 숨김 |
| Low | 유래(origin) 섹션 깊이 편차 | 검수 기준에 "원 출처 1개+확산 타임라인" 필수화 |

---

## Category Deep Dives (요약)

### AI Citability (76) — 강점
상세 페이지의 "무슨 뜻이에요? → 정의 / 어디서 시작됐어요? → 유래" 구조는 AI 답변 엔진 인용에 최적.
정의 문단이 문맥 독립적으로 작성돼 단독 인용 가능. `__NEXT_DATA__` 없는 완전 SSR이라 JS 미실행 크롤러도 전문 수집.

### Brand Authority (3) — 최대 약점
위키피디아(ko/en API)·레딧·유튜브·네이버 전 채널에서 "밈캐치" 언급 0건. 온페이지 최적화로는 해결 불가 —
위 "남은 항목"의 UGC 전략이 유일한 경로.

### Content E-E-A-T (43 → 개선)
검수 로직은 실존하나 비가시였음 → /about에 명시. 신뢰 문서 4종(About/Privacy/Terms/Footer) 신설로
Trust 축 회복. 남은 과제: 출처 상시 인용, 수정일 UI 노출.

### Technical GEO (78 → 개선)
SSR·robots·sitemap 우수. canonical·og:image·보안 헤더·llms.txt·preconnect 이번에 보강.
/explore 동적 렌더(no-store)는 가시성 문제는 없으나 확장성 관점 개선 후보.

### Schema (25 → 대폭 개선)
"파싱 실패 의심" JSON-LD는 Next.js RSC flight payload 오탐으로 판명(실제 스키마는 유효).
이번 반영으로 Organization·WebPage(dates/speakable)·Breadcrumb·Video·DefinedTermSet·CollectionPage·
ItemList·ForumPosting 추가 — 스키마 축 예상 25→75+.

### Platform (58)
카카오 공유는 상세 페이지 정상(동적 OG), 홈도 이번에 확보. 최대 공백은 네이버 미등록(사용자 작업 필요).

---

## 30-Day Action Plan (운영 중심)

### Week 1
- [ ] 네이버 서치어드바이저 등록 + 소유확인 토큰 전달 → 메타 반영
- [ ] 구글 서치콘솔 등록·sitemap 제출
### Week 2
- [ ] 나무위키 서비스 문서 초안 + 대표 밈 문서 3곳 외부링크
- [ ] 유튜브 쇼츠 채널 개설(주 2회, 밈 30초 해설)
### Week 3
- [ ] r/korea·디시 발원 스레드 출처 코멘트 5건 (9:1 원칙)
- [ ] 커뮤니티 시딩 상호작용
### Week 4
- [ ] 신규 밈 유래 섹션 품질 기준 적용
- [ ] AI 챗봇(ChatGPT/Perplexity)에 "밈 뜻" 질의해 인용 여부 첫 측정
