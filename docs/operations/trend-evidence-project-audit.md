# 밈캐치 트렌드 증거 파이프라인 프로젝트 감사

> 기준일: 2026-10-13
>
> 범위: 저장소의 현재 코드와 마이그레이션을 읽어 재사용 지점과 미검증 경계를 기록한다. 이 문서는 운영 DB 적용, 외부 API 연결, 운영 배포가 완료되었다는 증거가 아니다.

## 1. 결론

밈캐치는 이미 밈 문서, 출처 원장, 운영자 검수, 내부 반응 점수, 외부 Radar 신호 수집, Vercel Cron을 갖고 있다. 따라서 새 시스템은 별도 CMS·벡터 DB·마이크로서비스가 아니라 기존 Supabase 원장과 관리자 화면을 확장하는 것이 맞다.

이번 확장의 핵심은 서로 다른 세 축을 같은 숫자로 합치지 않는 것이다.

1. **외부 확산**: 정책상 사용 가능한 원자료, 독립 작성자, 비교 가능한 시점별 측정치로만 판정한다.
2. **밈캐치 내 인기**: 조회·댓글·반응·저장 등 서비스 내부 행동으로 계산한다.
3. **편집 우선순위**: 후보의 중복 여부, 근거 충실도, 안전 검수 필요성, 문서 보완 가치로 운영자가 정한다.

신규 `trend_candidates` 계열은 이 세 축을 분리하고, 승인된 결과만 기존 `memes` 상세 화면에 투영하도록 설계되어 있다. 이는 기존 콘텐츠 모델을 대체하지 않고 후보 발굴·증거·검수 원장을 보강한다 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:95-178`).

## 2. 벤치마크에서 확인할 수 있는 것과 없는 것

벤치마크 대상은 `https://reelpd.high-curve.co.kr`이다. 공개 메뉴에서 보이는 탐색·필터, 브랜드 아카이브, 트렌드, 레퍼런스 분석, 보드·기획·진행 기록이라는 **사용자 흐름**만 정보 구조 참고 대상으로 삼는다.

다음은 공개 화면만으로 확인할 수 없으므로 릴피디의 실제 구현이라고 서술하거나 복제하지 않는다.

- 실제 수집 공급자와 계약·권한 범위
- 내부 API와 데이터 보존 정책
- 트렌드 선정 산식과 임계값
- AI 프롬프트와 자동 게시 조건
- 플랫폼별 파생 분석·결합 승인 상태

밈캐치는 독립적으로 `후보 발견 → 원자료 확인 → 중복 제거·밈별 묶음 → 외부 확산 검증 → 근거 기반 초안 → 운영자 검수 → 기존 상세 공개` 흐름을 사용한다. 외부 플랫폼 정책 확인은 해당 공식 문서를 기준으로 하며, 특히 YouTube는 검색 결과와 영상 통계를 구분해야 한다.

- YouTube `search.list`: <https://developers.google.com/youtube/v3/docs/search/list>
- YouTube `videos.list`: <https://developers.google.com/youtube/v3/docs/videos/list>
- YouTube API Services 정책 가이드: <https://developers.google.com/youtube/terms/developer-policies-guide>
- YouTube 파생 측정치 정책: <https://developers.google.com/youtube/terms/derived-metrics-policy>

## 3. 현행 기술 스택

| 항목 | 저장소에서 확인한 구현 | 근거 |
| --- | --- | --- |
| 웹 | Next.js 16.3.4, React 19.2.4, TypeScript, Tailwind CSS 4 | `package.json:63-89`, `package.json:91-105` |
| 실행·검증 | `next dev`, Webpack 기반 빌드, ESLint, Vitest | `package.json:15-23` |
| DB·인증 | Supabase Postgres, Supabase Auth, RLS, RPC | `lib/supabase/server.ts:20-41`, `supabase/migrations/20260708004500_schema_v2.sql:1-21` |
| ORM | 별도 ORM 없음. 타입이 적용된 Supabase client와 SQL/RPC를 직접 사용 | `package.json:63-89`, `lib/supabase/server.ts:20-66` |
| 관리자 권한 | 세션 사용자 확인 뒤 `is_operator` RPC 재검증 | `app/(default)/admin/require-operator.ts:9-30`, `supabase/migrations/20260708004500_schema_v2.sql:319-322` |
| 관리자 화면 | 기존 `/admin` 체계 안에 외부 후보·정책·실행·측정·검수 화면 추가 | `app/(default)/admin/trend-candidates/page.tsx:114-172`, `app/(default)/admin/trend-candidates/page.tsx:187-203` |
| 스케줄러 | Vercel Cron. 트렌드 pulse는 6시간 간격 | `vercel.json:3-15` |
| Cron 인증 | 서버 전용 `CRON_SECRET` Bearer 검증 후 pulse 실행 | `app/api/cron/trend-pulse/route.ts:6-23` |
| 작업자 패턴 | DB 기반 MPE·영상 작업자 스크립트가 이미 존재 | `package.json:26-36` |

공개 카탈로그 캐시는 인증 쿠키가 없는 제한된 GET과 고정 projection에만 60초 적용되고, 나머지는 `no-store`다 (`lib/supabase/public-catalog-cache.ts:15-62`). 트렌드 공개 요약도 허용 projection에 포함되어 기존 캐시 경계를 재사용한다 (`lib/supabase/public-catalog-cache.ts:8-10`, `lib/supabase/public-catalog-cache.ts:34-50`).

## 4. 기존 밈·출처·검수 모델

### 4.1 밈 문서와 분류

`memes`가 공개 문서의 중심이다. 제목, URL용 `short_id`/slug, 별칭 배열, 요약·설명, 유래·사용 맥락·주의점, 안전 신호, 생명주기, 검수 상태, 분류, 미디어 유형, 난이도·정서, 연도, 내부 trend score를 가진다 (`supabase/migrations/20260708004500_schema_v2.sql:75-112`).

- 분류: phrase, dance, song, image, comment, challenge (`supabase/migrations/20260708004500_schema_v2.sql:6-13`).
- 검수: pending, fact checking, rights checking, approved, limited, rejected (`supabase/migrations/20260708004500_schema_v2.sql:6-16`).
- 승인·제한 상태로 전환될 때 공개 시각을 설정하는 상태 전이 보호가 있다 (`supabase/migrations/20260708004500_schema_v2.sql:113-133`).
- 검색은 제목·요약·초성·별칭·trigram을 결합하고 마지막 정렬 신호로 내부 `trend_score`를 쓴다 (`supabase/migrations/20260708004500_schema_v2.sql:488-503`).

별칭은 별도 중복 테이블이 아니라 기존 `memes.aliases`를 계속 사용한다. 신규 후보의 별칭·변형·재유행 연결은 검수 뒤 이 기존 모델에 연결해야 한다.

### 4.2 공개 출처와 임베드

기존 `meme_sources`와 `meme_contents`는 출처 URL과 플랫폼 콘텐츠 ID, 썸네일·캡션·대표 여부, 가용성, 검수 상태를 보관하며 임의 HTML 임베드를 저장하지 않는다 (`supabase/migrations/20260708004500_schema_v2.sql:134-160`).

운영 원장은 한 단계 더 엄격하다.

- `media_sources`: 플랫폼 콘텐츠 1건을 정규화하고 공개·임베드 가능 여부, 라이선스, 게시 시각, 갱신·만료·삭제 상태를 기록 (`supabase/migrations/20260723120000_source_pipeline.sql:23-74`).
- `meme_media`: 밈과 출처의 다대다 관계, original/earliest known/usage example 역할, 권리 근거, 검수 상태를 기록 (`supabase/migrations/20260723120000_source_pipeline.sql:76-115`).
- `meme_claims`: 유래·뜻·최초 사용·유행 시기·제작자·사용 맥락 주장과 근거를 연결하며 운영자 확인 전 `verified=false` (`supabase/migrations/20260723120000_source_pipeline.sql:117-141`).
- 원본 파일을 재호스팅하지 않고 링크·공식 임베드만 공개하며, 승인된 항목만 기존 공개 테이블로 복사한다 (`supabase/migrations/20260723120000_source_pipeline.sql:1-6`).

상세 페이지는 TikTok·Instagram 항목을 “관련 사용 예시”로 명시하여 확인되지 않은 원본으로 단정하지 않고, 공식 임베드 컴포넌트를 사용한다 (`app/(default)/memes/[key]/page.tsx:362-381`).

### 4.3 사용 안전 신호와 Life signal

안전성과 유행 생명주기는 별도 enum과 UI로 유지된다.

- 안전 단계: green/yellow/gray/red; 생명주기: rising/active/cooling/archived (`supabase/migrations/20260708004500_schema_v2.sql:6-15`).
- 사용자 문구는 안전 단계와 생명주기에 각각 별도 매핑 (`lib/labels.ts:7-20`).
- 안전 배지는 색상만이 아니라 아이콘·문구를 함께 사용하고 모션 감소 설정을 고려 (`components/safety-badge.tsx:6-23`, `components/safety-badge.tsx:24-68`).
- Life signal 컴포넌트는 상태, 설명, 신뢰 신호를 독립적으로 표시 (`components/signal-trace.tsx:3-10`, `components/signal-trace.tsx:30-55`, `components/signal-trace.tsx:57-135`).
- 상세 화면은 안전 근거와 외부 트렌드 근거를 서로 다른 데이터로 구성한다 (`app/(default)/memes/[key]/page.tsx:394-404`).

현재 기본 생명주기 자동화는 내부 활동이 30일 없으면 cooling, 최근 공개된 밈의 내부 점수가 1.5를 넘으면 rising으로 바꾸는 단순 규칙이다 (`supabase/migrations/20260708004500_schema_v2.sql:469-474`). 이것을 외부 확산 상태로 해석하면 안 된다.

## 5. 현행 수집기와 점수

### 5.1 외부 Radar 수집

현재 등록 가능한 connector는 환경변수와 seed가 모두 있을 때만 활성화된다 (`lib/trend/radar-platform-connectors.server.ts:259-276`).

| 플랫폼 | 수집 범위 | 저장 모드·한계 | 근거 |
| --- | --- | --- | --- |
| X | 최근 한국어 텍스트, 작성자 ID, 게시 ID·URL·시각, 해시태그 | 리트윗·미디어 제외, link only | `lib/trend/radar-platform-connectors.server.ts:78-118` |
| Threads | 승인 범위의 keyword search 텍스트, URL·작성자·시각 | TEXT만, link only, seed별 부분 실패 허용 | `lib/trend/radar-platform-connectors.server.ts:121-179` |
| Instagram | 승인된 hashtag search/recent media 메타데이터, 좋아요·댓글 원시값 | 원본 미디어 미다운로드, API metadata | `lib/trend/radar-platform-connectors.server.ts:181-257` |

이 connector registry에는 YouTube와 TikTok 전수 발견 connector가 없다. `YOUTUBE_API_KEY`는 출처 후보와 메타데이터 재확인용 선택 설정으로 문서화되어 있으며 (`.env.example:176-179`), TikTok은 Login Kit 승인용 설정만 있다 (`.env.example:181-185`). 따라서 두 플랫폼의 자동 발견·상세 지표 연동을 구현 완료라고 표시할 수 없다.

Pulse는 신호 저장과 connector 상태 저장 후 기존 밈 이름·별칭을 제외한 신규 후보 발견을 선택적으로 실행한다. 일일 후보는 최대 150으로 강제 제한한다 (`lib/trend/radar-pulse.server.ts:99-128`). 기존 밈 연결은 confidence 0.9 이상만 자동 관계로 사용하고, 그보다 낮으면 검수 대기로 남기며 위험 신호는 안전 검수에 넣는다 (`lib/trend/radar-pulse.server.ts:134-164`).

### 5.2 기존 Radar heat 가설

기존 `calculateRadarSignal`은 관찰치마다 다음 heat를 만든다.

```text
observationHeat = velocity × 0.50 + engagement × 0.30 + volume × 0.20
baseWeight = max(0.05, freshness) × max(0.05, sourceReliability)
플랫폼 분자 = Σ(observationHeat × freshness × baseWeight)
플랫폼 분모 = Σ(baseWeight)
heat = 플랫폼별 (분자 ÷ 분모)의 평균
confidence = meanReliability × 0.65 + platformCoverage × 0.35
```

구현 근거는 `lib/trend/radar.ts:340-421`이다. YouTube와 YouTube Shorts는 결합 산정에서 명시적으로 제외된다 (`lib/trend/radar.ts:3-6`, `lib/trend/radar.ts:132-138`). 이 heat는 초기 Radar 가설이며, 플랫폼 정책·비교 가능성·독립 사용례를 모두 충족한 최종 외부 트렌드 점수가 아니다.

### 5.3 신규 외부 확산 점수 가설

신규 증거 계산은 다음 가중치를 사용한다 (`lib/trend/external-evidence.ts:10-16`).

```text
externalTrendScore = 100 × (
  growth × 0.35 + independentSpread × 0.25
  + relativePerformance × 0.20 + searchMomentum × 0.10
  + recentUsage × 0.10
)
```

안전장치는 다음과 같다.

- 정책상 허용되지 않거나 결측·비교 불가인 구성요소는 0으로 대체하지 않고 null과 사유로 남김 (`lib/trend/external-evidence.ts:188-213`).
- 누락 가중치를 재분배하지 않음.
- 최근 14일 독립 사용례 3건, 비교 가능한 양의 성장, 최소 3개 측정 구성요소가 모두 있어야 점수를 냄 (`lib/trend/external-evidence.ts:215-226`).
- 독립 사용례는 relationship이 independent로 검수되고 작성자가 있으며, 같은 콘텐츠와 같은 작성자를 각각 한 번만 셈 (`lib/trend/external-evidence.ts:146-164`).
- 오래된 원자료가 최근 다시 독립 사용되면 기존 밈과 연결된 revival로, 누적 도달만 크고 확산 조건이 없으면 popular content로 구분 (`lib/trend/external-evidence.ts:237-254`).
- confidence는 근거 coverage, 표본, 최신성, 측정 가능성으로 계산하고 AI의 주관적 확신을 쓰지 않음 (`lib/trend/external-evidence.ts:256-267`).
- 운영자 검수와 rising/revival 상태가 모두 충족되어야 공개 가능 (`lib/trend/external-evidence.ts:268-269`).

## 6. 내부 검색·조회·저장·공유·반응

내부 행동 원장은 이미 존재한다.

- 조회: 세션×밈×KST 일 단위 중복을 제거하는 `increment_view` (`supabase/migrations/20260708004500_schema_v2.sql:341-352`).
- 반응·저장: `meme_reactions`, `saved_memes`와 인증 사용자 RPC (`supabase/migrations/20260708004500_schema_v2.sql:193-207`, `supabase/migrations/20260708004500_schema_v2.sql:353-376`).
- 댓글·신고: discussion/reaction/report 원장과 RPC (`supabase/migrations/20260708004500_schema_v2.sql:218-264`, `supabase/migrations/20260708004500_schema_v2.sql:391-415`).
- 검색: 실제 렌더된 결과 수와 0건을 debounce 뒤 이벤트로 전송 (`components/search-outcome-tracker.tsx:7-23`, `components/search-outcome-tracker.tsx:31-60`).
- 공유: native share 또는 clipboard 뒤 `share_click` 이벤트 전송 (`components/share-button.tsx:7-9`, `components/share-button.tsx:30-45`).

현재 내부 일일 지표 테이블에는 views/comments/shares/saves/reactions/reports/submissions가 있다 (`supabase/migrations/20260708004500_schema_v2.sql:266-288`). 하지만 실제 trend rollup은 최근 24시간의 조회·댓글·저장·반응·신고만 채우고 shares와 submissions는 계산에 사용하지 않는다 (`supabase/migrations/20260708004500_schema_v2.sql:434-447`).

내부 `trend_score`는 최근 72시간에 다음 식을 적용한다 (`supabase/migrations/20260708004500_schema_v2.sql:449-467`).

```text
ln(1+views) × .25 + ln(1+comments) × .20
+ ln(1+reactions) × .20 + ln(1+saves) × .15
- ln(1+reports) × .10 + 공개 48시간 이내 .5
```

이 값은 **밈캐치 내 인기**다. 외부 SNS 전체 유행, 독립 변형, 상대적 플랫폼 성과를 증명하지 않는다.

클라이언트 분석은 GA 이벤트와 일부 durable growth event를 구분한다. 검색 원문은 공통 경계에서 제거되고 (`lib/analytics.ts:123-134`), durable 원장에는 meme view, follow, copy, share 등 allowlist된 이벤트만 들어간다 (`lib/analytics.ts:84-115`, `app/api/analytics/events/route.ts:17-31`). 수집 endpoint는 same-origin, IP·세션 rate limit, 크기 제한, 필드 allowlist, 분 단위 중복키를 적용한다 (`app/api/analytics/events/route.ts:38-63`, `app/api/analytics/events/route.ts:65-93`, `app/api/analytics/events/route.ts:105-148`).

따라서 검색 submit/no-result는 GA 관찰이며 durable 후보 증거가 아니고, share click도 현재 내부 `compute_trend_scores`의 shares 칼럼으로 자동 합산되지 않는다. 이를 이미 통합된 지표라고 보고하면 안 된다.

## 7. 신규 증거 원장과 기존 구조 재사용

### 7.1 중복 시스템을 만들지 않는 확장

신규 구조는 기존 `external_signals`와 `memes`를 그대로 중심에 둔다.

- `radar_source_policies`: 수집 필드, 파생 분석·플랫폼 결합 허용, cache TTL, 보존, 삭제 재확인, 승인 근거와 확인일 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:15-29`).
- `radar_discovery_seeds`: term/account/RSS/source seed와 신규 발견·후보 추적 lane별 호출 예산 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:31-43`).
- `radar_collection_runs`: 멱등키, 상태, 최대 8회 시도, 호출량, 비용 단위, 후보 상한, 재시도 시각, 마지막 오류 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:45-66`).
- `radar_metric_snapshots`: 원시/파생 측정치, 단위, 관찰 범위, 관찰·수집 시각, 보존 만료. 값 없음은 반드시 `missing_reason`과 함께 저장 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:68-93`).
- `trend_candidates`: 신규 밈/별칭/변형/재유행/인기 영상 후보, 기존 밈 연결, 원문 게시 시각과 최초 발견 시각 분리, 외부 상태·점수·confidence·근거·AI 초안·검수 상태 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:95-136`).
- `trend_candidate_signals`: 독립·재업로드·크로스포스트·인용·미확인 관계를 보관하고 검수된 independent만 집계 가능 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:138-148`).
- `trend_candidate_reviews`: 승인·수정·보류·거절·병합·분리·기존 밈/별칭 연결 이력 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:150-159`).
- `public_meme_trend_summaries`: 승인된 외부 확산 설명만 기존 밈 상세에 연결하는 공개 projection (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:164-178`).

후보·정책·실행·측정·검수 원장은 운영자만 읽고, 공개 사용자는 공개 projection만 읽는다 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:181-224`). 기존 관리자 인증과 RLS를 재사용하므로 service-role을 브라우저 관리자 UI에 새로 노출하지 않는다.

### 7.2 공개 무결성

승인된 공개 projection도 영구 고정값으로 신뢰하지 않는다.

- 관계, 외부 신호 가용성·만료·URL·작성자, 출처 정책이 바뀌면 공개 요약 삭제 (`supabase/migrations/20261013140000_trend_evidence_review_integrity.sql:32-97`).
- 익명 공개 read 시에도 candidate 승인·rising/revival·비교 성장·7일 이내 평가를 재검증 (`supabase/migrations/20261013140000_trend_evidence_review_integrity.sql:99-114`).
- 최근 14일, 서로 다른 작성자와 서로 다른 신호가 각각 3건 이상이며 URL·가용성·보존·메타데이터·정책 허용을 충족해야 함 (`supabase/migrations/20261013140000_trend_evidence_review_integrity.sql:115-147`).
- 둘 이상의 플랫폼을 결합하면 모든 관련 정책이 결합을 허용해야 함 (`supabase/migrations/20261013140000_trend_evidence_review_integrity.sql:148-164`).
- 운영자 review RPC만 승인·병합·분리·기존 밈/별칭 연결을 수행 (`supabase/migrations/20261013140000_trend_evidence_review_integrity.sql:175-228`).

관리자 화면은 정책의 활성 상태·수집 필드·파생/결합 허용·보존·승인 근거, 최근 run의 호출·비용·오류를 표시하며 비밀키는 표시하지 않는다 (`app/(default)/admin/trend-candidates/page.tsx:127-203`). 후보 화면은 원문 게시·최초 발견·마지막 측정을 별도로 표시하고 (`app/(default)/admin/trend-candidates/page.tsx:214-228`), 원시 측정값 `0`과 결측/null을 구분한다 (`app/(default)/admin/trend-candidates/page.tsx:250-263`). 예시 데이터로 빈 후보 목록을 채우지 않는다 (`app/(default)/admin/trend-candidates/page.tsx:204-208`).

## 8. 외부 API, 캐시, 큐, 로그, 비용 제한

### 8.1 환경변수 이름

아래는 저장소에서 확인한 이름이며 값이나 실제 운영 설정 여부는 이 문서에 기록하지 않는다.

| 목적 | 환경변수 |
| --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Cron | `CRON_SECRET` |
| Radar 기능·상한 | `RADAR_DISCOVERY_ENABLED`, `RADAR_DISCOVERY_DAILY_CANDIDATE_LIMIT`, `RADAR_AI_DRAFT_ENABLED`, `RADAR_AI_DRAFT_DAILY_LIMIT` |
| lane 예산 | `RADAR_NEW_DISCOVERY_CALL_BUDGET_PER_RUN`, `RADAR_CANDIDATE_TRACKING_CALL_BUDGET_PER_RUN` |
| X | `X_API_BEARER_TOKEN`, `RADAR_X_TERMS` |
| Threads | `THREADS_ACCESS_TOKEN`, `RADAR_THREADS_TERMS` |
| Instagram | `META_INSTAGRAM_ACCESS_TOKEN`, `META_INSTAGRAM_USER_ID`, `RADAR_INSTAGRAM_HASHTAGS`, `META_GRAPH_API_VERSION` |
| YouTube | `YOUTUBE_API_KEY`, `RADAR_YOUTUBE_DAILY_CALL_LIMIT` |
| 선택 AI 초안 | `OPENAI_API_KEY`, `OPENAI_REVIEW_BASE_URL` |

체크인된 예시는 Radar 발견과 AI 초안을 기본 비활성으로 두고, 후보 150건/일과 AI 초안 20건/일을 운영 가설 상한으로 문서화한다 (`.env.example:147-158`). 이는 목표 수량이나 성과 보장이 아니다.

### 8.2 운영 통제

- 캐시: 공개·익명·bounded GET만 60초 캐시하고 운영자·인증·원시 증거 쿼리는 캐시하지 않음 (`lib/supabase/public-catalog-cache.ts:15-62`).
- 큐: 별도 워크플로 엔진 대신 DB run 상태와 기존 worker 패턴 재사용. 신규 collection run은 멱등키, 상태, 제한 재시도, backoff 시각, 실패 이유를 저장 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:45-66`).
- 로그: 일반 배치는 `job_runs`, 관리자 행위는 `admin_audit_log`에 기록 (`supabase/migrations/20260708004500_schema_v2.sql:289-317`). 외부 수집은 connector health와 collection run의 `last_error`를 사용한다 (`lib/trend/radar-pulse.server.ts:106-114`, `supabase/migrations/20261013120000_trend_evidence_pipeline.sql:45-60`). 중앙 로그 집계 시스템은 이 감사 범위에서 확인하지 못했다.
- 비용: run별 calls/cost units, seed별 call budget, 후보 상한, 일일 YouTube 호출 상한 이름을 저장·설정한다 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:31-66`, `.env.example:151-158`). 실제 공급자 할당량·청구액 연결은 별도 운영 검증이 필요하다.
- 보존·삭제: snapshot 보존 만료, source policy 보존일, 외부 신호 unavailable 상태를 저장하고 공개 projection을 실시간 무효화한다 (`supabase/migrations/20261013120000_trend_evidence_pipeline.sql:3-29`, `supabase/migrations/20261013120000_trend_evidence_pipeline.sql:68-93`, `supabase/migrations/20261013140000_trend_evidence_review_integrity.sql:50-97`).

## 9. 데이터 흐름과 세 지표의 소유권

```text
승인된 connector / 운영자 URL 등록 / 사용자 제보
  → external_signals (게시물 단위, canonical identity)
  → radar_metric_snapshots (시점별 값 또는 결측 사유)
  → trend_candidates + trend_candidate_signals (밈 종류 묶음, 관계 미확인은 보류)
  → deterministic assessment (외부 확산, 점수 없을 수 있음)
  → AI 초안 (비신뢰·근거 ID 포함, 순위 결정권 없음)
  → 운영자 검수·병합·분리·기존 밈 연결
  → public_meme_trend_summaries
  → 기존 홈 급상승 영역 / 기존 밈 상세
```

| 축 | 입력 | 출력 | 자동 공개 여부 |
| --- | --- | --- | --- |
| 외부 확산 | 정책 허용 신호, 독립 사용례, 시점별 측정, 검색 보조 신호 | observing/popular content/rising/revival, 조건부 점수·confidence | 운영자 승인과 live evidence RLS 통과 시만 |
| 밈캐치 내 인기 | 조회·댓글·저장·반응·신고 등 내부 행동 | 기존 `memes.trend_score` | 기존 홈 정렬 등에 사용 가능하지만 외부 유행 문구 금지 |
| 편집 우선순위 | 중복 후보, evidence coverage, 안전 검수, 문서 결손, 운영 비용 | 후보 큐의 검수 순서와 결정 이력 | 높은 우선순위만으로 콘텐츠 자동 공개 금지 |

이 분리가 필요한 이유는 내부 방문자가 적어도 외부 후보를 찾을 수 있어야 하고, 반대로 내부 조회수가 높다는 사실을 “전체 SNS 유행”으로 오인해서도 안 되기 때문이다. 편집 우선순위는 독자의 수요와 운영 비용을 다루는 작업 큐이지 인기 점수가 아니다.

## 10. 확인된 공백과 연동 상태 표기 원칙

### 코드로 구현되어 있음

- 기존 Supabase/Auth/RLS/Admin/Cron을 재사용하는 증거·후보·검수 모델
- 원자료 게시 시각, 최초 발견 시각, 관찰·수집 시각의 분리
- null+결측 사유와 실제 0의 구분
- URL/콘텐츠/작성자 중복 제거와 독립 관계 검수
- 정책상 미허용 파생 분석·플랫폼 결합 차단
- 승인된 공개 projection의 만료·삭제·정책 변경 무효화
- 예시 데이터 없는 관리자 검수 큐

### 실서비스 연동 검증이 필요함

- 신규 마이그레이션의 운영 DB 적용 여부
- X·Threads·Instagram 앱의 실제 승인 권한, 호출 성공, 삭제 갱신
- YouTube 할당량과 허용 사용 사례 검토 후 discovery/metadata connector 활성화
- TikTok·Instagram의 승인되지 않은 범용 공개 지표는 미연동으로 표시
- Naver DataLab 실제 연동과 동일 조건 구간 비교 구현
- source policy의 승인 근거·확인일을 운영자가 실제 입력했는지
- 외부 API 비용 단위가 실제 청구/할당량과 일치하는지
- 6시간 Cron의 실제 운영 실행 및 장애 알림

API 키가 없거나 정책이 비활성이면 해당 connector만 disabled로 남기고, 운영자 URL 등록·검수 흐름은 계속 사용할 수 있어야 한다. 연동 실패나 예산 초과는 0 반응이 아니라 실패·결측으로 저장하며, 마지막 유효 결과는 stale 상태와 마지막 확인 시각을 함께 표시해야 한다.

## 11. 감사상 권고되는 첫 운영 순서

1. 운영자가 source policy에 공식 승인 근거, 확인일, 허용 필드, 파생·결합 여부, 보존일을 입력한다.
2. 키 없는 상태에서 수동 URL 후보 등록, canonical 중복, 게시/발견 시각 분리, 병합·분리 검수를 검증한다.
3. 하나의 승인된 connector만 낮은 call budget으로 활성화해 run·snapshot·결측·삭제 흐름을 검증한다.
4. 독립 사용례 3건과 비교 성장 조건을 일부러 충족/미충족시켜 공개 projection의 생성·차단을 검증한다.
5. 내부 trend score와 외부 trend summary가 UI·문구·정렬에서 섞이지 않는지 확인한다.
6. 실제 채택률, 발견 지연, 승인 한 건당 비용·검수 시간을 관찰한 뒤 가중치와 임계값을 조정한다.

이 순서 전에는 “외부 트렌드 연동 완료”가 아니라 **코드 구현 완료, 운영 연동 미검증**으로 보고해야 한다.
