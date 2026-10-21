# 밈 외부 확산 근거 파이프라인 운영 가이드

> 기준일: 2026-10-13
>
> 현재 상태: **로컬 구현·검증 완료, 운영 미배포**. 사용자가 운영 DB migration·환경변수·웹 활성화를 허용했지만, 이 문서를 갱신한 시점에는 운영 migration, 운영 환경변수 설정, 웹 배포, 운영 Cron 실행을 아직 완료하지 않았다. 이후 운영 상태는 실제 적용 증거를 확인한 뒤 이 문서의 상태표만 갱신한다.

저장소 전체 구조와 기존 모델 재사용 근거는 [트렌드 증거 파이프라인 프로젝트 감사](./trend-evidence-project-audit.md)를 함께 본다.

## 1. 목표와 범위

이 파이프라인은 밈캐치를 단순한 밈 사전에서 다음 흐름을 갖는 서비스로 확장한다.

```text
후보 발견
→ 원자료 확인
→ URL·게시물·작성자 중복 제거
→ 게시물별 증거를 밈·포맷 후보에 연결
→ 실제 외부 확산 검증
→ 근거 기반 설명과 활용 초안
→ 운영자 검수
→ 기존 홈과 밈 상세에 공개
```

1차 범위는 후보 수집, 중복 정리, 근거 보관, 조건부 선별, 검수 큐, 기존 화면 연결이다. 다음은 포함하지 않는다.

- 영상 다운로드·편집·재업로드
- 쇼츠 자동 양산
- 기존 승인 콘텐츠 전수 덮어쓰기
- 높은 점수만으로 신규 문서 자동 공개
- 유료 데이터 공급자 가입이나 결제
- 새로운 벡터 DB·마이크로서비스·대형 워크플로 엔진

## 2. 반드시 분리하는 세 가지 지표

- **최근 등록**: 밈캐치에서 문서가 공개된 시각이다.
- **밈캐치 내 인기**: 내부 조회·댓글·저장·반응 등 서비스 내 행동이다.
- **외부 확산**: 허용된 외부 원자료에서 확인한 독립 사용례와 비교 가능한 성장이다.
- **편집 우선순위**: 후보 중복, 근거 충실도, 안전 검수, 문서 보완 가치와 운영 비용을 고려한 작업 순서다.

외부 확산, 내부 인기, 편집 우선순위는 하나의 “전체 SNS 점수”로 합치지 않는다. 내부 방문자가 적어도 외부 후보 발굴은 가능해야 하며, 내부 조회수가 높다는 이유만으로 외부 유행이라고 표시하지 않는다.

## 3. 벤치마크와 정책 경계

벤치마크 `https://reelpd.high-curve.co.kr`에서는 공개 메뉴에서 확인 가능한 탐색·필터, 브랜드 아카이브, 트렌드, 레퍼런스 분석, 보드·기획·진행 기록의 흐름만 참고한다. 실제 공급자, 내부 API, 산식, AI 프롬프트는 확인되지 않았으며 릴피디의 실제 구현이라고 서술하거나 복제하지 않는다.

외부 플랫폼은 공개 열람 가능성과 저장·재배포·분석 허용을 구분한다. 최신 승인 범위와 실제 프로젝트 할당량을 확인하기 전에는 해당 정책을 `enabled=false`로 둔다.

공식 확인 기준:

- YouTube `search.list`: <https://developers.google.com/youtube/v3/docs/search/list>
- YouTube `videos.list`: <https://developers.google.com/youtube/v3/docs/videos/list>
- YouTube API Services 정책: <https://developers.google.com/youtube/terms/developer-policies-guide>
- YouTube 파생 측정치 정책: <https://developers.google.com/youtube/terms/derived-metrics-policy>
- Instagram Hashtag Search: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/hashtag-search>
- Threads Keyword Search: <https://developers.facebook.com/docs/threads/keyword-search>
- X Recent Search: <https://docs.x.com/x-api/posts/recent-search/introduction>
- TikTok Research API: <https://developers.tiktok.com/products/research-api/>
- 네이버 데이터랩 검색어 트렌드 API: <https://developers.naver.com/docs/serviceapi/datalab/search/search.md>

## 4. 데이터 흐름

### 4.1 후보 발견

1. 활성화된 `radar_source_policies`와 `radar_discovery_seeds`를 읽는다.
2. `new_discovery`와 `candidate_tracking` lane의 호출 예산을 독립적으로 계산한다.
3. 현재 1차 실데이터 collector는 YouTube의 허용된 검색·영상 메타데이터를 사용한다.
4. 검색 결과만으로 통계·Shorts·임베드 가능 여부를 확정하지 않고 `videos.list` 확인 결과를 별도 보관한다.
5. 실제 응답에서 반복된 표현만 후보로 추출한다. seed 자체와 기존 밈 이름·별칭은 신규 후보에서 제외한다.
6. 운영자가 키 없이도 공개 URL을 수동 등록할 수 있다. 이 경우 메타데이터와 지표는 `unverified`/빈 값이며 독립 확산으로 집계하지 않는다.

AI가 실데이터 후보를 만들어 넣지 않는다. 후보가 적으면 적은 수 그대로 유지한다.

### 4.2 게시물 단위와 밈 단위

- `external_signals`: 플랫폼 게시물 한 건의 canonical identity, URL, 게시·발견·관찰·수집 시각, 작성자 키, 가용성과 보존 시각을 저장한다.
- `radar_metric_snapshots`: 측정값·단위·관찰 범위·측정 시각·수집 시각을 저장한다. 실제 0은 `0`, 수집 불가나 미반환은 `null + missing_reason`이다.
- `trend_candidates`: 신규 밈, 별칭, 변형, 재유행, 단일 인기 영상 후보를 구분한다.
- `trend_candidate_signals`: independent/repost/crosspost/citation/unknown 관계를 저장한다. 운영자가 관계를 확인하기 전에는 independent로 집계하지 않는다.

추적 파라미터만 다른 URL, 동일 플랫폼 게시물 ID, 동일 작성자의 크로스포스트는 독립 확산으로 중복 집계하지 않는다. 음원이 같다는 이유만으로 다른 챌린지를 병합하지 않는다.

### 4.3 검증과 공개

1. 테스트 가능한 코드가 성장·독립 확산·상대 성과·검색 모멘텀·최근 사용을 계산한다.
2. 정책상 허용되지 않거나 비교할 수 없는 값은 점수에서 제외하되 남은 가중치를 재분배하지 않는다.
3. 신호가 부족하면 점수를 만들지 않고 `observing`으로 둔다.
4. AI는 제공된 근거만으로 편집 초안을 만들 수 있지만 순위·공개 결정을 하지 않는다.
5. 운영자는 `/admin/trend-candidates`에서 원문, 관계, 원시 측정, 정책, 최근 run, 중복 후보, AI 초안과 검수 이력을 확인한다.
6. 승인된 `public_meme_trend_summaries`만 기존 홈과 밈 상세에서 읽는다.

## 5. 공개 승인 게이트

승인 RPC와 공개 RLS는 다음 조건을 확인한다.

- 기존 공개 밈 UUID에 연결됨
- candidate가 운영자 검수 완료 상태
- 외부 상태가 `rising` 또는 `revival`
- 비교 가능한 성장 근거 존재
- 최근 14일의 서로 다른 작성자·서로 다른 게시물 독립 사용례 각각 3건 이상
- 관계가 `independent`, `relationship_reviewed=true`, `counts_as_independent=true`
- 원문 URL, 게시 시각, 가용성, 보존 기한, metadata 검증이 유효함
- source policy가 활성 상태이며 파생 분석을 허용함
- 여러 플랫폼을 합칠 때 모든 관련 policy가 플랫폼 간 결합을 허용함
- 운영자가 공개 설명, 조사 범위, 실제 evidence link를 입력함
- 마지막 평가가 7일보다 오래되지 않음

점수가 높아도 자동 공개하지 않는다. 출처가 삭제·비공개·만료되거나 관계·정책이 바뀌면 기존 공개 projection도 즉시 무효화된다.

## 6. 스케줄·잠금·재시도·비용 제한

| 항목 | 현재 기본값·제약 |
| --- | --- |
| Cron | 6시간 간격, Vercel `/api/cron/trend-pulse` |
| 동일 구간 멱등성 | 6시간 bucket + connector + lane idempotency key |
| 신규 탐색 lane | 실행당 기본 20 API call 상한 |
| 후보 추적 lane | 실행당 기본 30 API call 상한 |
| YouTube 일일 app 상한 | 기본 90 call 예약. 실제 Google Cloud quota가 90이라는 뜻이 아니며 프로젝트 할당량은 미검증 |
| 후보 | 하루 최대 150건 |
| AI 초안 | 활성화된 경우 하루 최대 20건 |
| 실행 시간 | 기본 40초, 최대 45초 |
| 요청 timeout | 기본 10초, 최대 15초 |
| lease | 120초; call 예약 때 heartbeat와 만료 갱신 |
| 최대 실행 시도 | 3회 |
| 실패 backoff | 1차 실패 후 60초, 2차 실패 후 120초; 식은 최대 3,600초로 cap되지만 현재 3회 제한 때문에 자동 예약은 두 구간만 사용 |
| retention | YouTube raw metadata/snapshot 최대 30일 후 갱신 또는 삭제 |

API 호출은 DB RPC에서 실행별·일별로 먼저 예약한다. 예산을 넘으면 `budget_exhausted`로 끝내며, 사용자 요청 경로에서는 외부 수집이나 AI 분석을 실행하지 않는다. 실패와 실제 반응 0을 구분하고, 오래된 마지막 유효 결과는 `last_verified_at`·`stale_after`로 표시한다.

seed별 `call_budget_per_run`이 더 작으면 환경변수 상한보다 seed 합계가 우선한다. 신규 탐색과 후보 추적 예산을 서로 빌려 쓰지 않는다.

## 7. 환경변수

값은 출력하거나 문서·로그에 저장하지 않는다. 키가 없으면 해당 collector만 비활성화하고 수동 URL 등록·검수는 유지한다.

### 필수 기반

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

### Radar 기능·예산

- `RADAR_DISCOVERY_ENABLED`
- `RADAR_DISCOVERY_DAILY_CANDIDATE_LIMIT`
- `RADAR_AI_DRAFT_ENABLED`
- `RADAR_AI_DRAFT_DAILY_LIMIT`
- `RADAR_YOUTUBE_DAILY_CALL_LIMIT`
- `RADAR_NEW_DISCOVERY_CALL_BUDGET_PER_RUN`
- `RADAR_CANDIDATE_TRACKING_CALL_BUDGET_PER_RUN`

### 플랫폼 선택 설정

- `YOUTUBE_API_KEY`
- `X_API_BEARER_TOKEN`
- `RADAR_X_TERMS`
- `THREADS_ACCESS_TOKEN`
- `RADAR_THREADS_TERMS`
- `META_INSTAGRAM_ACCESS_TOKEN`
- `META_INSTAGRAM_USER_ID`
- `RADAR_INSTAGRAM_HASHTAGS`
- `META_GRAPH_API_VERSION`

### 선택 AI 초안

- `OPENAI_API_KEY`
- `OPENAI_REVIEW_BASE_URL`

자동 수집용 YouTube policy와 seed는 migration에서 비활성으로 생성한다. 키가 필요 없는 `manual_link` policy만 활성 상태지만, 제출 메타데이터는 미검증이고 파생 분석·플랫폼 결합은 허용하지 않는다. 운영 전에는 각 policy의 collectable fields, 파생 분석·플랫폼 결합 허용, 보존일, 승인 근거와 확인일을 운영자가 다시 검수해야 한다.

## 8. 로컬 실행과 검증 명령

모든 명령은 저장소 루트에서 실행한다. 비밀키 값은 출력하지 않는다.

### 8.1 정적·단위 검증

```bash
pnpm exec vitest run \
  lib/trend \
  lib/actions/trend-candidate-entry.test.ts \
  lib/actions/trend-candidates.test.ts \
  'app/(default)/admin/trend-candidates' \
  app/api/cron/trend-pulse/route.test.ts \
  components/meme-external-trend-evidence.test.tsx \
  scripts/trend-runtime-local.test.ts \
  supabase/trend_collection_runtime_contract.test.ts \
  supabase/trend_evidence_pipeline_contract.test.ts \
  supabase/trend_evidence_review_integrity.test.ts

pnpm exec tsc --noEmit --pretty false
pnpm build
```

최종 로컬 결과:

- 관련 Vitest: **200개 통과**
- TypeScript: 통과
- Next production build: 통과
- 빌드 경고: 기존 일부 route의 `metadataBase` fallback 경고가 남아 있다. 이번 pipeline 회귀는 아니며 빌드 성공과 운영 배포 완료를 의미하지 않는다.

### 8.2 로컬 DB 계약

로컬 Supabase가 실행 중이고 신규 migration이 적용된 상태에서:

```bash
node scripts/verify-local-trend-db.mjs --refresh-functions
```

이 스크립트는 운영 DB에 연결하지 않고 `127.0.0.1:54322`만 사용한다. 결과:

- collection runtime pgTAP: **40개 통과**
- review integrity fixture: 통과
- service-role claim·quota·lease·retry, operator manual entry, private host 거절, missing/0, retention, merge/split, 승인·무효화 RLS를 확인

`--refresh-functions`는 로컬 반복 검증을 위한 새 함수·trigger·policy·seed 갱신이며 운영 적용 명령이 아니다. 전체 로컬 DB reset이나 기존 데이터 삭제를 수행하지 않는다.

### 8.3 제한된 YouTube 실데이터 + 로컬 DB 통합

```bash
node scripts/trend-runtime-local.mjs --live-local
```

가드는 Supabase endpoint가 `http://127.0.0.1:54321` 또는 localhost인지 확인하고, 로컬 service role과 YouTube key를 child test에만 전달한 뒤 출력에서 비밀을 제거한다. 운영 DB에는 쓰지 않는다.

최종 로컬 관찰 결과:

| 항목 | 결과 |
| --- | ---: |
| YouTube 공식 API 호출 | 2회 |
| 저장된 게시물 신호 | 25건 |
| 저장된 metric snapshot | 75건 |
| 발견 후보 | 4건 |
| 후보 관계 | 전부 `unknown`, 미검수, independent 집계 0 |
| 공개 projection | 0건 |
| 동일 6시간 구간 재실행 호출 | 0회 |

동일 구간 재실행에서 run을 다시 claim하지 않고 일일 호출 예약량도 늘지 않았다. 테스트가 임시로 YouTube policy와 seed를 활성화한 뒤 `finally`에서 원래 비활성 상태로 복원했다. 이 수치는 한 번의 제한된 로컬 관찰 결과이며 수집량 보장, 현재 인기 순위, Google quota 잔량 증거가 아니다.

별도의 DB 없는 bounded API 확인은 다음 명령을 사용할 수 있다.

```bash
node scripts/trend-discovery-local.mjs --live
```

이 명령은 공식 API를 최대 2회 읽고 로컬 `artifacts/trend-discovery-local/latest-observations.json`에 evidence를 쓴다. 운영 DB나 공개 콘텐츠를 변경하지 않는다.

## 9. 1차 변경 파일 manifest

### 데이터 계약과 운영 안전장치

- `supabase/migrations/20261013120000_trend_evidence_pipeline.sql`
- `supabase/migrations/20261013130000_trend_collection_runtime.sql`
- `supabase/migrations/20261013140000_trend_evidence_review_integrity.sql`
- `supabase/tests/trend_collection_runtime.sql`
- `supabase/tests/trend_evidence_review_integrity.sql`
- `supabase/trend_collection_runtime_contract.test.ts`
- `supabase/trend_evidence_pipeline_contract.test.ts`
- `supabase/trend_evidence_review_integrity.test.ts`
- `lib/database.types.ts`

### 발견·수집·판정

- `lib/trend/discovery-collector.ts`
- `lib/trend/discovery-runtime.server.ts`
- `lib/trend/observation-assessment.ts`
- `lib/trend/external-evidence.ts`
- `lib/trend/assessment-runtime.server.ts`
- `lib/trend/candidate-discovery.ts`
- `lib/trend/legacy-policy-gate.ts`
- `lib/trend/evidence-draft.ts`
- `lib/trend/draft-completion.server.ts`
- `lib/trend/database-contract.ts`
- `lib/trend/pulse.server.ts`
- `lib/trend/public-evidence.server.ts`
- 위 모듈의 인접 `*.test.ts`

### 관리자 검수·수동 등록

- `lib/actions/trend-candidate-entry.ts`
- `lib/actions/trend-candidate-entry.test.ts`
- `lib/actions/trend-candidates.ts`
- `lib/actions/trend-candidates.test.ts`
- `app/(default)/admin/trend-candidates/page.tsx`
- `app/(default)/admin/trend-candidates/entry-form.tsx`
- `app/(default)/admin/trend-candidates/entry-form.test.tsx`
- `app/(default)/admin/trend-candidates/review-form.tsx`
- `app/(default)/admin/trend-candidates/review-form.test.tsx`
- `app/(default)/admin/trend-candidates/signal-review-form.tsx`
- `components/admin/admin-nav.tsx`

### 공개 화면·Cron·캐시

- `components/home/home-trend-discovery.tsx`
- `components/meme-external-trend-evidence.tsx`
- `components/meme-external-trend-evidence.test.tsx`
- `app/(default)/page.tsx`
- `app/(default)/memes/[key]/page.tsx`
- `app/[locale]/memes/[key]/page.tsx`
- `app/api/cron/trend-pulse/route.ts`
- `app/api/cron/trend-pulse/route.test.ts`
- `lib/supabase/public-catalog-cache.ts`
- `vercel.json`

### 로컬 운영 도구와 문서

- `scripts/trend-discovery-local.mjs`
- `scripts/trend-runtime-local.mjs`
- `scripts/trend-runtime-local.test.ts`
- `scripts/verify-local-trend-db.mjs`
- `.env.example`
- `docs/operations/trend-evidence-project-audit.md`
- `docs/operations/trend-evidence-pipeline.md`

## 10. 미연동·미검증 항목

| 항목 | 현재 상태 | 활성화 전 필요 증거 |
| --- | --- | --- |
| 운영 Supabase | 미적용 | migration 적용 로그, RLS/RPC smoke, 기존 데이터 보존 확인 |
| 운영 웹 | 미배포 | 환경변수 설정, production build, 배포 ID, 실제 route smoke |
| 운영 Cron | 미실행 | `CRON_SECRET`, 6시간 schedule, run/job log, 실패 알림 |
| YouTube | 로컬 공식 API 2회만 확인 | 실제 Google Cloud 프로젝트 quota·사용 사례 승인, 운영 key 설정, 비용/호출 대조 |
| Instagram | 자동 운영 미연동 | Professional 계정·Facebook Login·Hashtag Search 권한, 허용 필드·보존 정책 |
| Threads | 자동 운영 미연동 | keyword search 승인 범위와 토큰, 텍스트 전용 정책 확인 |
| X | 자동 운영 미연동 | recent search 접근, pay-per-use spending limit, 보존·분석 정책 확인 |
| TikTok | URL 등록·검수만 | 승인 API 없이 범용 공개 지표를 얻는다고 가정하지 않음. Research API를 상업용 기본 공급원으로 쓰지 않음 |
| 네이버 데이터랩 | 미연동 | 발견된 키워드 보조 검증 전용 구현, 동일 조건·완결 구간·상대지수 처리 |
| AI 초안 | 코드 경계만, live 품질 증거 없음 | 실제 모델 연결, 일일 20건 예약, evidence-bound 출력·prompt injection 검수 |

현재 로컬 실데이터에서 작성자·게시 시각·통계가 공급자 응답에 없으면 null과 사유로 저장한다. 검색 제목·설명만 확인한 경우 영상 장면·자막·음원을 분석했다고 쓰지 않는다.

## 11. 운영 적용 순서

사용자가 운영 활성화를 허용했더라도 단계별 결과를 확인한 후 다음 단계로 이동한다.

1. 운영 DB 백업·현재 migration 상태 확인.
2. 세 신규 migration을 순서대로 적용.
3. 운영 DB에서 테이블/RPC/RLS, 자동 수집 policy·seed의 기본 `enabled=false`, `manual_link`의 미검증·비파생 계약을 확인.
4. 비밀값을 출력하지 않고 Vercel 환경변수 이름과 scope 확인·설정.
5. 첫 배포는 `RADAR_DISCOVERY_ENABLED=false`, `RADAR_AI_DRAFT_ENABLED=false` 유지.
6. 홈·상세·관리자·Cron 인증 fail-soft smoke 확인.
7. 운영자가 source policy 승인 근거와 확인일을 검수.
8. YouTube만 낮은 seed budget으로 canary 활성화하고 run/call/snapshot/candidate/public=0을 확인.
9. 동일 bucket 재실행이 0 call인지 확인.
10. 실제 근거를 운영자가 관계 분류·승인하기 전 공개 projection이 없는지 확인.

운영 적용 후에는 “migration 적용”, “환경변수 설정”, “웹 배포”, “Cron 실행”, “실데이터 수집”, “운영자 승인”, “공개 노출”을 각각 별도 상태로 보고한다.

## 12. 롤백

- **즉시 수집 중단**: `RADAR_DISCOVERY_ENABLED=false`; source policy와 seed도 `enabled=false`로 전환한다.
- **AI 중단**: `RADAR_AI_DRAFT_ENABLED=false`. 기존 후보·근거는 보존한다.
- **공개 회수**: 후보를 승인 외 상태로 변경하거나 관련 policy를 비활성화하면 공개 projection이 무효화된다.
- **웹 롤백**: 홈·상세의 외부 확산 컴포넌트 호출을 이전 배포로 되돌린다. 기존 검색·상세 URL·안전 신호·Life signal·임베드는 독립적으로 유지한다.
- **DB 롤백**: 데이터를 즉시 drop하지 않는다. 수집·공개 읽기를 먼저 중단하고 백업과 참조를 확인한 뒤 별도 승인된 down migration을 사용한다.

## 13. 보고 문구

현재 정확한 보고는 다음과 같다.

> 1차 외부 확산 증거 파이프라인은 로컬 코드·DB 계약·제한된 YouTube API 통합 검증을 통과했다. 2회 API 호출에서 25개 신호, 75개 snapshot, 4개 미검수 후보를 로컬 DB에 저장했고 공개 projection은 0건이었다. 동일 6시간 구간 재실행은 0회 호출이었다. 운영 DB·환경변수·웹·Cron은 아직 적용되지 않았고, Google 실제 quota, Instagram·Threads·X·TikTok·네이버 데이터랩, AI live 초안은 검증되지 않았다.

운영 적용 증거가 생기기 전에는 “실서비스 연동 완료”, “전체 SNS 트렌드”, “자동 AI 콘텐츠 생산 완료”라고 표현하지 않는다.
