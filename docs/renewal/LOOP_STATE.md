# LOOP_STATE

> 루프 런타임의 영구 상태. 매 루프 시작 시 **이 파일을 먼저 읽는다.**
> 규격: 저장소 루트 `LOOP.md`

## 현재 루프

| 항목 | 값 |
| --- | --- |
| 루프 번호 | **001** (기준선 확립) |
| 상태 | `continue` |
| 날짜 | 2026-08-03 |
| 브랜치 | `main` |
| 산출물 | `artifacts/renewal/loop-001/` |

## 전체 목표

데이터 신뢰도와 화면 이해도를 동시에 높인다. 사용자는 상세 첫 화면에서 밈의 한 줄 뜻과
사용 신호를 이해하고, 각 주장의 근거·권리·마지막 검수 시점을 추적할 수 있어야 한다.
운영 조건은 1인 개발·운영이므로 유지보수 비용이 낮은 구조만 채택한다.

## 시스템 지도 (루프 001에서 확인)

| 영역 | 실제 |
| --- | --- |
| 프레임워크 | Next.js 16.2.10 App Router · React 19.2.4 · Tailwind v4 |
| 패키지 매니저 | pnpm (`pnpm-lock.yaml`) |
| 빌드 | `next build --webpack` |
| 테스트 | `vitest run` — `**/*.test.ts(x)` (스크립트 일부는 `node *.test.mjs` 별도) |
| Lint | `eslint` (eslint-config-next) |
| 타입 | `tsc --noEmit` (별도 package script 없음 — 직접 호출) |
| DB | Supabase Postgres 17 (`onjipuldngbdptldkpoe`, ap-northeast-1) |
| 마이그레이션 | `supabase/migrations/*.sql` 27개 — RLS 기본 deny + RPC 쓰기 경계 |
| 배포 | Vercel (`vercel.json`) |
| 크론 | `pg_cron` → `compute_trend_scores()` 일 1회 (최근 67회 전부 성공) |
| 분석 | GA(`NEXT_PUBLIC_GA_ID`) + `lib/analytics.ts` |
| Feature flag | `lib/flags.ts` + `NEXT_PUBLIC_*` 환경변수 |
| 관리자 검수 | `/admin/memes`, `/admin/sources`, `/admin/submissions`, `/admin/reports` |
| 공개 상태 전이 | `check_moderation_transition()` 트리거 — pending→fact_checking→rights_checking→approved/limited |

### 기존에 이미 있어 재사용하는 자산 (새로 만들지 않는다)

- **`lib/content-depth.ts`** — 문서 충실도 스코어러(0~13점). LOOP.md가 말하는 DQI
  자리를 이미 차지하고 있고 `app/sitemap.ts`·상세 `robots`·광고 게재 판정의 **단일
  기준점**이다. 별도 DQI를 새로 만들지 않고 이 함수를 확장·재사용한다.
- **`is_meme_rank_eligible()` / `meme_ranking_completeness()`** — 랭킹 진입 게이트(SQL).
- **`media_sources` / `meme_media` / `meme_claims`** — LOOP.md가 권장한 논리 모델
  (`source_role`, `rights_basis`, claim↔source 연결)이 **이미 스키마에 존재한다.**
  문제는 스키마가 아니라 채워지지 않은 데이터다(위험 5번).
- **`scripts/source-pipeline-rest.mjs`** — PostgREST 페이지네이션 헬퍼(`restAll`).

## 완료된 작업 (루프 001)

- 저장소·스키마·라우트 지도 작성 → 이 파일 + `DECISIONS.md`
- 프로덕션 **읽기 전용** 데이터 기준선 측정 → `BASELINE.json`
- 재실행 가능한 품질 검사기 구현 → `scripts/quality-check.mts` (`pnpm quality:check`)
- 검사기 단위 테스트 8건 → `scripts/quality-check.test.ts`
- 첫 품질 리포트 생성 → `DATA_QUALITY_REPORT.json`
- 모바일 390×844 상세·랭킹 계측 → `DESIGN_AUDIT.md`
- 초기 가설 8개 증거 검증 (4 확정 / 2 부분 확정 / 1 기각 / 1 미검증)
- 우선순위 backlog 13건 → `BACKLOG.md`
- HUMAN_GATE 5건 정리 → `DECISIONS.md`

## 진행 중인 작업

없음. 루프 001은 기준선 단계이므로 제품 UI·프로덕션 데이터를 변경하지 않았다.

## 마지막 검증 결과 (2026-08-03, `artifacts/renewal/loop-001/verify.log`)

| 검사 | 명령 | 결과 |
| --- | --- | --- |
| 단위/통합 테스트 | `npx vitest run` | ✅ 71 파일 / **605 통과** (기존 597 + 신규 8) |
| Lint | `npx eslint` | ✅ 0 error / 5 warning (전부 기존 `no-img-element`) |
| 타입 | `npx tsc --noEmit` | ✅ 통과 |
| 프로덕션 빌드 | `npx next build --webpack` | ✅ 성공 |
| 데이터 품질 검사기 | `pnpm quality:check` | ⚠️ **의도된 실패** — critical 4건 검출로 exit 1 |
| e2e / 핵심 route smoke | — | `not_run` — e2e 프레임워크 미도입 |
| 마이그레이션 dry-run | — | `not_run` — 루프 001은 스키마를 변경하지 않음 |
| 접근성 자동 검사 | — | `not_run` — 도구 미도입 (BACKLOG `A11Y-001`) |
| 반응형 스크린샷 회귀 | — | `not_run` — 360/768/1440 뷰포트 미측정. 390×844만 수동 계측 |
| metadata/canonical 검사 | — | `not_run` — 자동 검사 없음. 빌드 산출물 육안 확인만 |
| 성능 회귀 검사 | — | `not_run` — LCP/INP/CLS 기준선 미측정 (BACKLOG `PERF-001`) |

## 현재 주요 위험

1. **무출처 공개 문서 1330건(34.1%)** 인데 화면은 “밈캐치 검수팀 확인”이라고 말한다.
   신뢰도 주장이 근거보다 앞서 있다 → LOOP.md critical flag 1번.
2. **공개 문서의 96.3%가 충실도 미달**이라 색인 대상이 145건뿐이고, “아직 정리 중인
   문서예요” 배너가 사실상 전 문서에 뜬다. `components/doc-status-note.tsx`의 주석이
   경고한 “모든 문서에 붙는 순간 의미 없는 템플릿” 상태에 이미 도달했다.
3. **모바일 상세 첫 뷰포트에 밈 정보가 0.** h1이 1399px 아래(1.66 뷰포트)에 있다.
4. **상황별 사용 신호의 84.8%가 4개 상황 전부 동일값.** 화면은 상황별 판정처럼
   보여주지만 데이터는 사실상 단일값이다.
5. **`meme_claims` 0건 · `meme_media.source_role` 100% `usage_example`.** 주장 단위
   근거 연결 설비가 스키마에만 있고 운영되지 않는다.
6. 로컬 `.env.production`의 `SUPABASE_SERVICE_ROLE_KEY`가 401을 반환한다(anon 키는
   정상 200). service_role을 쓰는 운영 스크립트가 지금 동작하지 않을 수 있다.

## 다음 후보 작업 3개

1. **DQ-005** — `region_blocked` 대표 콘텐츠가 상세에서 그대로 렌더된다(코드 gap 1곳).
   우선순위 75.0 · 노력 1 · 프로덕션 쓰기 없음.
2. **DQ-001** — 출처 0건 문서에서 “밈캐치 검수팀 확인” 문구를 실제 근거 수에 따라
   조건부로 바꾼다. 우선순위 62.5 · 프로덕션 쓰기 없음.
3. **DES-001** — 모바일 상세 정보 계층 재배치(정답 카드 → 대표 미디어 순).
   우선순위 37.5.

## 중단 조건 충족 여부

| 조건 | 충족 |
| --- | --- |
| 완료 (`CATCHMEME_RENEWAL_DONE`) | ❌ critical backlog 4건 미해결 |
| 사람 결정 필요 (`CATCHMEME_HUMAN_DECISION_REQUIRED`) | ⚠️ HUMAN_GATE 5건 대기. 다만 게이트 없이 진행 가능한 작업이 남아 루프는 계속 |
| 안전 중단 (`CATCHMEME_SAFETY_STOP`) | ❌ 해당 없음 |
| 반복 제한 | 1 / 12 |
