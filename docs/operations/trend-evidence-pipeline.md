# 밈 외부 확산 근거 파이프라인 운영 가이드

> 기준일: 2026-10-14 KST
>
> 현재 상태: **YouTube raw-metadata canary의 운영 활성화와 실제 API 수집 검증 완료**. 현재 production은 `dpl_626e9JRnENohCMujGxyF2Nw7nuYo`, release `youtube-raw-27a66c393f86`이다. 1회 completed run에서 공식 API 2회, signal 25건, raw snapshot 75건을 저장했으며 candidate·AI draft·공개 projection은 모두 0건이다. 이는 수집 경계 검증이지 현재 유행 선정이나 자동 공개 완료를 뜻하지 않는다.

저장소 전체 구조와 기존 모델 재사용 근거는 [트렌드 증거 파이프라인 프로젝트 감사](./trend-evidence-project-audit.md)를 함께 본다.

운영에 적용된 migration 버전은 다음과 같다. 저장소 파일명과 운영 적용 버전은 배포 과정의 timestamp가 다르므로 둘을 구분한다.

| 역할 | 저장소 migration | 운영 적용 버전 | 상태 |
| --- | --- | --- | --- |
| 증거 pipeline | `20261013120000_trend_evidence_pipeline.sql` | `20261013123330` | 적용 완료 |
| 전용 scheduler | `20261013150000_trend_evidence_scheduler.sql` | `20261013123807` | 적용 완료 |
| collection runtime | `20261013130000_trend_collection_runtime.sql` | `20261013124039` | 적용 완료 |
| review integrity | `20261013140000_trend_evidence_review_integrity.sql` | `20261013124111` | 적용 완료 |

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

외부 플랫폼은 공개 열람 가능성과 저장·재배포·분석 허용을 구분한다. raw 공식 API canary는 콘솔의 API 활성 상태와 제한된 호출 예산을 확인한 범위에서만 켤 수 있다. 파생 분석·플랫폼 결합·재배포는 별도 정책 근거가 확인되기 전까지 `false`로 유지하며, 제한된 raw canary를 승인된 전체 사용 사례라고 표현하지 않는다.

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

| 항목 | 구현 기본값·현재 운영 canary |
| --- | --- |
| 외부 후보 수집 Cron | 기존 Supabase `pg_cron` 전용 worker, `0 */6 * * *` UTC(KST 03·09·15·21시), `/api/cron/trend-discovery` 호출 |
| 실패 재시도 Cron | 5분 간격, 실패 상태만 대상으로 제한 |
| 내부 인기 Cron | Vercel Hobby 제약에 맞춰 기존 daily `0 18 * * *`, `/api/cron/trend-pulse`; 외부 후보 수집과 별도 |
| 동일 구간 멱등성 | 6시간 bucket + connector + lane idempotency key |
| 구현 기본 lane 상한 | 신규 탐색 20, 후보 추적 30 call/run. 운영 canary보다 큰 구현 상한이며 현재 설정값이 아님 |
| 운영 canary lane | 신규 탐색 2, 후보 추적 0 call/run |
| 운영 seed | 1개 활성, seed별 2 call/run |
| 운영 app ledger | KST 일일 8 call 상한 |
| Google Cloud Console 관찰 | 프로젝트 ID `catchmeme`, 프로젝트 번호 `633617605564`; YouTube `search` 일일 100 중 3, 일반 일일 10,000 중 3 사용으로 01:50:59 KST 최종 재확인. 특정 운영 호출 귀속과 운영 key 소유 fingerprint는 미확인 |
| 후보 | 구현상 하루 최대 150건. 운영 canary 수집 결과 0건이며 목표 수집량이 아님 |
| AI 초안 | 구현상 활성화 시 하루 최대 20건. 현재 `enabled=false`, 일일 0건 |
| 실행 시간 | 기본 40초, 최대 45초 |
| 요청 timeout | 기본 10초, 최대 15초 |
| lease | 120초; call 예약 때 heartbeat와 만료 갱신 |
| 최대 실행 시도 | 3회 |
| 실패 backoff | 1차 실패 후 60초, 2차 실패 후 120초; 식은 최대 3,600초로 cap되지만 현재 3회 제한 때문에 자동 예약은 두 구간만 사용 |
| retention | YouTube raw metadata/snapshot 최대 30일 후 갱신 또는 삭제 |

API 호출은 DB RPC에서 실행별·일별로 먼저 예약한다. 예산을 넘으면 `budget_exhausted`로 끝내며, 사용자 요청 경로에서는 외부 수집이나 AI 분석을 실행하지 않는다. 실패와 실제 반응 0을 구분하고, 오래된 마지막 유효 결과는 `last_verified_at`·`stale_after`로 표시한다.

운영 scheduler migration은 전용 job 두 개를 등록했다. `TREND_CRON_SECRET`와 Vault의 `memecatch_trend_cron_secret`는 같은 새 전용 secret으로 연결됐고, 값은 문서나 출력에 남기지 않았다. 기존 `memecatch-trend-daily`(`30 15 * * *` UTC), MCP 5분 job, Vercel 내부 인기 daily job은 제거하거나 변경하지 않았다.

scheduler가 runtime migration보다 먼저 적용된 12:40 UTC에 `lease_expires_at`이 없어 retry가 한 번 실패한 이력이 있다. runtime migration `20261013124039` 적용 후 12:45, 12:50부터 13:10까지 후속 retry는 성공했다. 이 이력을 지우거나 “실패 이력 0건”이라고 보고하지 않는다.

seed별 `call_budget_per_run`이 더 작으면 환경변수 상한보다 seed 합계가 우선한다. 신규 탐색과 후보 추적 예산을 서로 빌려 쓰지 않는다.

## 7. 환경변수

값은 출력하거나 문서·로그에 저장하지 않는다. 키가 없으면 해당 collector만 비활성화하고 수동 URL 등록·검수는 유지한다.

### 필수 기반

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `TREND_CRON_SECRET`

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

자동 수집용 YouTube policy와 seed는 migration에서는 비활성으로 생성한다. 2026-10-14 canary에서 정책과 밈 seed 1개만 운영 스크립트로 활성화했으며 DB migration을 추가하지 않았다. SQL connector write는 두 번 시도했지만 만료된 request state로 DB에 영향을 주지 않았고, 기존 SDK 기반 `artifacts/release/20261014-youtube-raw/activate-source.mjs` fallback이 policy 1개와 seed 1개만 활성화했다.

현재 운영 확인값은 `RADAR_DISCOVERY_ENABLED=true`, `RADAR_AI_DRAFT_ENABLED=false`다. YouTube source policy는 `enabled=true`, 파생 분석과 플랫폼 간 결합은 각각 `false`, raw retention은 30일이다. 밈 seed 1개만 활성화됐고 나머지 seed는 비활성이다. `manual_link`도 활성 상태지만 metadata는 `unverified`이며 자동 독립 확산·공개 근거로 승격하지 않는다. `CRON_SECRET`은 기존 내부 인기 Cron용이고, `TREND_CRON_SECRET`은 외부 후보 수집 전용으로 분리한다.

## 8. 로컬 실행과 검증 명령

모든 명령은 저장소 루트에서 실행한다. 비밀키 값은 출력하지 않는다.

### 8.1 정적·단위 검증

```bash
./node_modules/.bin/vitest run \
  lib/trend \
  lib/actions/trend-candidate-entry.test.ts \
  lib/actions/trend-candidates.test.ts \
  'app/(default)/admin/trend-candidates' \
  'app/(default)/memes/[key]/page.test.ts' \
  app/api/cron/trend-discovery/route.test.ts \
  app/api/cron/trend-pulse/route.test.ts \
  components/admin/admin-nav.test.tsx \
  components/meme-external-trend-evidence.test.tsx \
  lib/supabase/public-catalog-cache.test.ts \
  scripts/trend-runtime-local.test.ts \
  supabase/trend_collection_runtime_contract.test.ts \
  supabase/trend_evidence_pipeline_contract.test.ts \
  supabase/trend_evidence_review_integrity.test.ts \
  supabase/trend_evidence_scheduler_contract.test.ts

./node_modules/.bin/tsc --noEmit --pretty false
pnpm build
```

기준 trend release `final2`와 2026-10-14 raw gate overlay 검증 결과:

- 기준 trend release Vitest: **32개 파일, 217개 통과·1개 skip**
- raw gate overlay focused test: **37개 통과**
- 최종 raw-only frozen source 전체 회귀: **34개 파일, 227개 통과·opt-in live 1개 skip**. 운영 실제 API canary는 이 skip과 별도로 검증했다.
- TypeScript: 통과
- 변경 범위 ESLint: 통과
- Next production build: **실제 production 환경변수를 사용한 Vercel cloud build 통과**
- 고정 소스의 로컬 `vercel build`는 내려받은 sensitive 환경변수 placeholder 때문에 정적 생성의 URL 검증에서 실패했다. 이를 로컬 빌드 성공으로 기록하지 않으며, 실제 환경의 cloud build 성공과 운영 smoke를 배포 증거로 사용했다.
- cloud build에는 기존 일부 정적 번역 홈 editorial 조회 fallback 경고가 남았다. 빌드 성공만으로 외부 연동·현재 유행 검증 완료를 의미하지 않는다.

최종 frozen source 회귀는 이미 설치된 `node_modules`의 Vitest 실행 파일을 직접 사용했고, 현재 작업 공간의 집중 회귀·TypeScript·ESLint는 `pnpm exec`로 통과했다. 이전 symlink 환경에서는 pnpm 자동 설치 시도가 차단된 이력이 있지만 이번 검증에서 패키지 재설치나 lockfile 변경은 하지 않았다.

### 8.2 로컬 DB 계약

로컬 Supabase가 실행 중이고 신규 migration이 적용된 상태에서:

```bash
node scripts/verify-local-trend-db.mjs --refresh-functions-only
```

이 스크립트는 운영 DB에 연결하지 않고 `127.0.0.1:54322`만 사용한다. 결과:

- collection runtime pgTAP: **40개 통과**
- review integrity fixture: 통과
- service-role claim·quota·lease·retry, operator manual entry, private host 거절, missing/0, retention, merge/split, 승인·무효화 RLS를 확인

`--refresh-functions-only`는 로컬 반복 검증을 위해 새 함수·trigger·policy만 갱신하며 seed는 다시 쓰지 않는다. 전체 로컬 DB reset이나 기존 데이터 삭제를 수행하지 않는다. 최종 재검증은 exit 0, pgTAP **40/40**이었고 integrity fixture는 의도대로 `ROLLBACK`으로 끝났다.

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

### 8.4 운영 YouTube raw canary·공개 QA

현재 운영 배포와 source 일치:

- production deployment: `dpl_626e9JRnENohCMujGxyF2Nw7nuYo`
- release header: `youtube-raw-27a66c393f86`
- release source-manifest SHA-256: `27a66c393f86284094127dedc74c218e639d3ef7088960533b84f8c23c452941`
- 구성: 고정 기준 release `trend-843bc202631d` 140개 파일 + overlay 10개(raw gate 6, privacy·terms 4), 최종 unique source manifest 144개 파일

운영 canary request `3967`과 동일 구간 replay `3968`은 모두 HTTP 200, `timed_out=false`였다. DB에는 completed run 1건, API call 2회, attempt 1회만 남아 replay 멱등성을 확인했다.

운영 수집 결과:

| 항목 | 결과 |
| --- | ---: |
| 기존 밈 / 승인 밈 | 5,030건 / 4,384건, 활성화 전후 동일 |
| completed run / API call / attempt | 1건 / 2회 / 1회 |
| external signal | 25건 |
| raw metric snapshot | 75건 |
| TTL 누락 / 30일 초과 | 0건 / 0건 |
| 파생 hashtag non-empty / 파생 content hash non-null | 모두 0건(raw-only 계약 유지) |
| 게시 시각 누락 | 0건 |
| candidate / AI draft / public projection | 모두 0건 |
| YouTube policy | enabled `true`, derived `false`, cross-platform `false`, retention 30일 |
| 운영 seed·예산 | 밈 seed 1개, 2 call/run; 신규 탐색 2, 추적 0, KST 일일 app ledger 8 |

Google Cloud Console은 `ironjustlikethat@gmail.com` 계정의 프로젝트 ID `catchmeme`, 프로젝트 번호 `633617605564`에서 YouTube Data API 활성 상태를 확인했다. 01:34 KST 표시는 `search` 일일 100 중 2, 일반 일일 10,000 중 2 사용이었고, 01:50:59 KST 읽기 전용 재조회에서는 각각 3으로 증가했다. 특정 운영 호출의 반영 여부까지는 확인할 수 없다. 운영 API key가 이 프로젝트 소유임을 증명하는 fingerprint는 확인하지 않았으므로, 이를 승인된 사용 사례나 key 소유권의 확정 증거로 과장하지 않는다. 최종 계정·프로젝트·할당량 확인은 `artifacts/release/20261014-youtube-raw/aside-quota-recheck.json`, DB와 worker 응답의 읽기 전용 재확인은 같은 디렉터리의 `production-db-canary.json`과 `production-worker-evidence.json`에 보존했다.

보안·공개 검증:

- public RLS predicate는 승인 projection만 읽으며 candidate는 operator 전용이다.
- anonymous/authenticated dispatch는 거부되고 anonymous expire도 거부된다.
- publisher UI: 16/16 page·viewport 조합 통과, execution·network error 0.
- 밈카드: touch·mouse, 4개 viewport, reduced-motion 통과, execution·network error 0.
- 기존 Chromium 도구의 `Permissions-Policy` warning만 관찰됐다.
- 최초 production QA에서 일시적인 PostgREST 500 때문에 Explore empty 검사가 한 번 실패했으나 재실행은 통과했다. 코드 수정 없이 회복됐으며 최초 실패 이력을 삭제하지 않는다.

증거 파일:

- [최종 운영 보고서](../../artifacts/release/20261014-youtube-raw/OPERATION-REPORT.md)
- `artifacts/release/20261014-youtube-raw/final3/source-manifest.json`
- `artifacts/release/20261014-youtube-raw/production-publisher-qa/publisher-page-qa-RLO3NE/report.json`
- `artifacts/release/20261014-youtube-raw/production-card-qa/meme-card-qa-Dxtuwn/report.json`

이번 단계는 실제 운영 API 수집 통합까지 검증했다. 그러나 candidate가 0건이고 운영자 승인·공개 projection도 0건이므로, 실제 현재 트렌드 선정·설명 작성·공개 노출을 검증한 것은 아니다. 운영 로그인 상태의 수동 URL 등록·검수 mutation E2E도 여전히 로컬 계약 테스트까지만 검증됐다.

## 9. 1차 변경 파일 manifest

### 데이터 계약과 운영 안전장치

- `supabase/migrations/20261013120000_trend_evidence_pipeline.sql`
- `supabase/migrations/20261013150000_trend_evidence_scheduler.sql`
- `supabase/migrations/20261013130000_trend_collection_runtime.sql`
- `supabase/migrations/20261013140000_trend_evidence_review_integrity.sql`
- `supabase/tests/trend_collection_runtime.sql`
- `supabase/tests/trend_evidence_review_integrity.sql`
- `supabase/trend_collection_runtime_contract.test.ts`
- `supabase/trend_evidence_pipeline_contract.test.ts`
- `supabase/trend_evidence_review_integrity.test.ts`
- `supabase/trend_evidence_scheduler_contract.test.ts`
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
- `app/api/cron/trend-discovery/route.ts`
- `app/api/cron/trend-discovery/route.test.ts`
- `lib/supabase/public-catalog-cache.ts`
- `vercel.json`

### 로컬 운영 도구와 문서

- `scripts/trend-discovery-local.mjs`
- `scripts/trend-runtime-local.mjs`
- `scripts/trend-runtime-local.test.ts`
- `scripts/verify-local-trend-db.mjs`
- `scripts/assemble-trend-release.mjs`
- `artifacts/release/20261013-trend-evidence/verify-production-cron.mjs`
- `artifacts/release/20261013-trend-evidence/public-smoke.mjs`
- `.env.example`
- `docs/operations/trend-evidence-project-audit.md`
- `docs/operations/trend-evidence-pipeline.md`

### 2026-10-14 raw gate overlay 10개

- `lib/trend/discovery-collector.ts`
- `lib/trend/discovery-collector.test.ts`
- `lib/trend/discovery-runtime.server.ts`
- `lib/trend/discovery-runtime.server.test.ts`
- `lib/trend/assessment-runtime.server.ts`
- `lib/trend/assessment-runtime.server.test.ts`
- `app/(default)/privacy/page.tsx`
- `app/(default)/privacy/page.test.tsx`
- `app/(default)/terms/page.tsx`
- `app/(default)/terms/page.test.tsx`

운영 활성화·검증 도구는 `artifacts/release/20261014-youtube-raw/` 아래의 `activate-source.mjs`, `stop-source.sql`, `verify-operation.sql`, `verify-upload-inputs.mjs`, `assemble-release.mjs`, `configure-env.mjs`로 보존한다. DB schema migration은 추가하지 않았다.

## 10. 운영 상태와 남은 검증

| 항목 | 현재 상태 | 남은 검증·운영 조건 |
| --- | --- | --- |
| 운영 Supabase | 4개 migration 적용, RLS·RPC 경계 확인. 기존 밈 5,030건·승인 4,384건 유지, 후보 0건·공개 projection 0건 | 지속 관찰 로그 |
| 운영 웹 | `dpl_626e9JRnENohCMujGxyF2Nw7nuYo` 승격, release `youtube-raw-27a66c393f86`, 공개 UI QA 통과 | 지속 모니터링 |
| 운영 Cron | 전용 Vault 연결, canary `3967`·replay `3968` HTTP 200. 6시간 job과 실패 전용 5분 retry 유지 | 다음 정시 실행과 실패 알림 지속 관찰 |
| 관리자 mutation E2E | 운영 로그인 상태에서는 미실행. 로컬 계약 테스트만 통과 | 운영자 계정으로 수동 등록·검수·병합·분리의 비파괴적 canary 검증 |
| YouTube | raw policy·밈 seed 1개 활성, 운영 API 2회로 signal 25·snapshot 75 저장. 파생 분석·플랫폼 결합 불허 | key 소유 project fingerprint, 승인된 사용 사례, Console 반영 지연과 장기 비용·호출 대조 |
| Instagram | 자동 운영 미연동 | Professional 계정·Facebook Login·Hashtag Search 권한, 허용 필드·보존 정책 |
| Threads | 자동 운영 미연동 | keyword search 승인 범위와 토큰, 텍스트 전용 정책 확인 |
| X | 자동 운영 미연동 | recent search 접근, pay-per-use spending limit, 보존·분석 정책 확인 |
| TikTok | URL 등록·검수만 | 승인 API 없이 범용 공개 지표를 얻는다고 가정하지 않음. Research API를 상업용 기본 공급원으로 쓰지 않음 |
| 네이버 데이터랩 | 미연동 | 발견된 키워드 보조 검증 전용 구현, 동일 조건·완결 구간·상대지수 처리 |
| AI 초안 | `enabled=false`, 일일 한도 0, live 품질 증거 없음 | 별도 활성화 전 모델 연결, evidence-bound 출력·prompt injection 검수와 새 일일 예산 승인 |

현재 로컬 실데이터에서 작성자·게시 시각·통계가 공급자 응답에 없으면 null과 사유로 저장한다. 검색 제목·설명만 확인한 경우 영상 장면·자막·음원을 분석했다고 쓰지 않는다.

## 11. 운영 적용 상태와 다음 순서

완료된 단계와 남은 단계를 섞어 “운영 활성화 완료”로 보고하지 않는다.

1. **완료**: 운영 DB migration 4건과 기존 밈 5,030건·승인 4,384건 보존을 확인했다.
2. **완료**: raw-only YouTube policy와 밈 seed 1개를 낮은 budget으로 활성화했다. 파생 분석·플랫폼 결합은 계속 불허한다.
3. **완료**: production `dpl_626e9JRnENohCMujGxyF2Nw7nuYo`와 source manifest를 확인했다.
4. **완료**: canary request `3967`에서 API 2회, signal 25건, raw snapshot 75건을 저장했다.
5. **완료**: replay `3968`이 새 run·attempt·호출을 만들지 않는 멱등성을 확인했다.
6. **완료**: TTL·raw hash·게시 시각 계약, 공개 RLS, UI 16/16과 카드 touch·mouse·reduced-motion을 확인했다.
7. **의도적 0건**: candidate·AI draft·public projection이 모두 0이므로 현재 트렌드 선정·자동 설명·공개는 발생하지 않았다.
8. **미검증**: 운영 로그인 관리자 폼 mutation E2E, 운영 key의 project fingerprint, 승인된 YouTube 사용 사례.
9. 다음 정시 run과 Console 사용량 반영을 관찰하되, 데이터가 부족하면 후보나 순위를 만들지 않는다.

운영 적용 후에는 “migration 적용”, “환경변수 설정”, “웹 배포”, “Cron 실행”, “실데이터 수집”, “운영자 승인”, “공개 노출”을 각각 별도 상태로 보고한다.

## 12. 롤백

- **즉시 수집 중단**: 먼저 `artifacts/release/20261014-youtube-raw/stop-source.sql`로 YouTube source policy와 seed를 비활성화하고 `memecatch-trend-discovery`, `memecatch-trend-discovery-retry` 두 전용 DB job을 disable 또는 unschedule한다. 기존 내부 인기 daily job과 MCP job은 함께 제거하지 않는다.
- **기능 flag 중단**: `RADAR_DISCOVERY_ENABLED=false`를 설정한 뒤 새 배포에 반영한다. Vercel 환경변수 변경만으로 현재 실행 중인 deployment가 즉시 바뀐다고 간주하지 않는다.
- **AI 중단**: `RADAR_AI_DRAFT_ENABLED=false`. 기존 후보·근거는 보존한다.
- **공개 회수**: 후보를 승인 외 상태로 변경하거나 관련 policy를 비활성화하면 공개 projection이 무효화된다.
- **웹 롤백**: source와 두 전용 DB job을 먼저 중단한 뒤, production을 raw canary 직전 기준 deployment `dpl_AbZxL7je4g15zfsEHegY8PNP8sqj`로 되돌린다. 기존 검색·상세 URL·안전 신호·Life signal·임베드는 독립적으로 유지한다.
- **DB 롤백**: 스키마나 데이터를 drop하지 않는다. 전용 job과 기능 flag를 먼저 중단하고 기존 후보·근거·검수 이력을 보존한다. 파괴적 down migration은 별도 승인 없이는 실행하지 않는다.

## 13. 보고 문구

현재 정확한 보고는 다음과 같다.

> 외부 확산 증거 파이프라인의 YouTube raw canary는 production `dpl_626e9JRnENohCMujGxyF2Nw7nuYo`에서 실제 운영 API 수집까지 검증됐다. canary와 replay는 모두 HTTP 200이었고, completed run 1건·API call 2회·attempt 1회로 signal 25건과 raw snapshot 75건을 저장했다. 기존 밈 5,030건·승인 4,384건은 유지됐고 candidate·AI draft·public projection은 0건이다. 파생 분석과 플랫폼 결합은 비활성이고, 운영자 검수 없이 현재 트렌드 선정이나 공개가 일어나지 않았다. 운영 로그인 관리자 mutation E2E, 운영 key의 project fingerprint와 승인된 YouTube 사용 사례, 다른 플랫폼 연동과 AI live 초안은 검증되지 않았다.

Google Cloud Console에서 프로젝트 `catchmeme`의 API 활성 상태와 사용량 2를 확인했지만 운영 key 소유 fingerprint와 승인된 사용 사례는 별개다. “운영 raw 수집 통합 완료”와 “후보 유효성·운영자 승인·공개 노출 완료”를 구분한다. 후자의 증거가 생기기 전에는 “실제 현재 트렌드 선정 완료”, “전체 SNS 트렌드”, “자동 AI 콘텐츠 생산 완료”라고 표현하지 않는다.
