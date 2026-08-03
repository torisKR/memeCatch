# LOOP_STATE

> 루프 런타임의 영구 상태. 매 루프 시작 시 **이 파일을 먼저 읽는다.**
> 규격: 저장소 루트 `LOOP.md`

## 현재 루프

| 항목 | 값 |
| --- | --- |
| 루프 번호 | **003** |
| 선택 항목 | `DQ-001` — 근거 0건 문서가 “검수팀 확인”을 주장함 |
| 상태 | `continue` |
| 날짜 | 2026-08-04 |
| 브랜치 | `renewal/loop-001` |
| 산출물 | `artifacts/renewal/loop-001/` ~ `loop-003/` |

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

## 완료된 작업 (루프 002 — DQ-005)

렌더 가능성 판정을 `lib/content-availability.ts` 한 곳으로 모았다. 기존에는 같은
판정이 네 곳에 복사돼 있었고 전부 `dead`만 걸렀는데, DB 게이트
(`is_meme_rank_eligible`)는 `dead`와 `region_blocked`를 함께 제외한다. 그래서
랭킹에는 못 오르지만 상세에서는 임베드되는 콘텐츠가 있었다.

- `lib/content-availability.ts` 신규 — `UNAVAILABLE_STATUSES`,
  `isAvailableContent()`, `isRenderableContent()`
- 소비처 4곳이 같은 함수를 쓴다: 상세 `liveContents` · `MemeEmbed` 재생 분기 ·
  `content-depth`의 `liveMediaCount` · `quality-check`의 DQ-C2/DQ-H3
- 렌더 가능한 콘텐츠가 없을 때 섹션 `aria-label`이 「관련 콘텐츠」로 떨어지던
  불일치를 바로잡았다(컴포넌트에 넘기는 `isRepresentative`와 같은 식 사용)
- 신규 테스트 10건 (`content-availability.test.ts` 8, `meme-embed.test.tsx` 2)

**프로덕션 전후 비교** — `/memes/f384zwnp` (나빌레라, region_blocked YouTube)

| | 대표 콘텐츠 섹션 | iframe | 폴백 히어로 | canonical |
| --- | --- | :---: | :---: | --- |
| before (프로덕션) | `대표 콘텐츠` | ✅ 있음 | ❌ | 유지 |
| after (로컬 프로덕션 빌드) | `대표 콘텐츠` | ❌ 없음 | ✅ 「출처에서 원본 보기」 | 동일 |

정상 문서 `/memes/ra86attn`는 임베드가 그대로 유지돼 회귀가 없다.
데이터는 변경하지 않았으므로 `quality:check` 수치는 기준선과 동일하다 — 이 변경은
14건이 *보이는 방식*을 고친 것이지 14건을 없앤 것이 아니다.

## 완료된 작업 (루프 003 — DQ-001)

상세 페이지가 본문만 있으면 문서마다 똑같이 “밈캐치 검수팀 확인”을 출력하고 있었다.
공개 문서의 34.1%(1,330건)는 근거 출처가 하나도 없어, 확인한 적 없는 문서가 확인을
주장하는 상태였다 — LOOP.md critical flag 1번.

- `lib/source-links.ts`에 `summarizeEvidence()` 추가 — 근거 출처를 URL 중복 제거 후
  원본·보도(primary)와 맥락 위키(context)로 나눠 센다
- `components/trust-note.tsx` 신규 — 근거 상태 3단계
  - 0건 → “근거 출처 준비 중”. **검수 주장을 하지 않고** 제보 CTA를 연다
  - 맥락 위키만 → “맥락 출처 N개로 확인 — 원본은 아직 찾는 중”
  - 원본 있음 → “근거 출처 N개 확인 (원본·보도 M개)”
- 근거 수는 `meme_sources`만 센다. 기존 `sourceLinks`에는 재생용
  `meme_contents.url`이 섞여 있어 근거 0건 문서가 1건으로 보였다(해당 13건)
- 충실도(‘보강 중’)는 바로 위 `DocStatusNote`가 이미 말하므로 반복하지 않는다
- 신규 테스트 10건 (`trust-note.test.tsx` 7, `source-links.test.ts` 3)

**프로덕션 전후 비교** (세 상태 모두 실제 문서로 확인)

| 문서 | 근거 | before | after |
| --- | --- | --- | --- |
| `e8ferq5u` 리부트 서버 | 0건 | 밈캐치 검수팀 확인 | ◌ 근거 출처 준비 중 + 제보 CTA |
| `3fajbwre` 브금 | 맥락 1건 | 밈캐치 검수팀 확인 | ▲ 맥락 출처 1개로 확인 — 원본은 아직 찾는 중 |
| `z4ywt995` 임효준 귀화 논란 | 원본 5건 | 밈캐치 검수팀 확인 | ● 근거 출처 5개 확인 |

canonical·robots·JSON-LD 구조 전부 불변. 데이터 미변경이라 `quality:check` 수치도 동일.

## 진행 중인 작업

없음.

## 마지막 검증 결과 (2026-08-04 루프 003, `artifacts/renewal/loop-003/verify.log`)

| 검사 | 명령 | 결과 |
| --- | --- | --- |
| 단위/통합 테스트 | `npx vitest run` | ✅ 73 파일 / **625 통과** (615 + 신규 10) |
| Lint | `npx eslint` | ✅ 0 error / 5 warning (전부 기존 `no-img-element`) |
| 타입 | `npx tsc --noEmit` | ✅ 통과 |
| 프로덕션 빌드 | `npx next build --webpack` | ✅ 성공 |
| 데이터 품질 검사기 | `pnpm quality:check` | ⚠️ **의도된 실패** — critical 4건 검출로 exit 1 (기준선과 동일) |
| 핵심 route smoke | 로컬 프로덕션 빌드 + 브라우저 계측 | ✅ 근거 3상태(`e8ferq5u`·`3fajbwre`·`z4ywt995`) 전환 확인 |
| e2e 자동화 | — | `not_run` — e2e 프레임워크 미도입 |
| 마이그레이션 dry-run | — | `not_run` — 루프 001~003 모두 스키마를 변경하지 않음 |
| 접근성 자동 검사 | — | `not_run` — 도구 미도입 (BACKLOG `A11Y-001`) |
| 반응형 스크린샷 회귀 | — | `not_run` — 360/768/1440 뷰포트 미측정. 390×844만 수동 계측 |
| metadata/canonical 검사 | — | `not_run` — 자동 검사 없음. 빌드 산출물 육안 확인만 |
| 성능 회귀 검사 | — | `not_run` — LCP/INP/CLS 기준선 미측정 (BACKLOG `PERF-001`) |

## 현재 주요 위험

1. ~~무출처 공개 문서가 “검수팀 확인”을 주장~~ → **루프 003에서 해소.** 다만
   1,330건에 실제 근거를 붙이는 일은 그대로 남아 있다(편집 작업, DQ-007).
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

1. **DES-001** (37.5) — 모바일 상세 정보 계층 재배치(정답 카드 → 대표 미디어 순).
   기준선 h1 top=1399px → 완료 조건은 정답 카드 top < 844px.
2. **DES-002** (30.0) — 랭킹 산정 기간·갱신 시각·표본 부족 표기.
3. **DES-003** (30.0) — `doc-status-note.tsx:50`의 「을(를)」 조사 placeholder 제거.

## 중단 조건 충족 여부

| 조건 | 충족 |
| --- | --- |
| 완료 (`CATCHMEME_RENEWAL_DONE`) | ❌ `quality:check` critical 4개 검사가 여전히 위반. 화면 쪽 critical(DQ-005·DQ-001)은 해소됐지만 데이터 쪽(무출처 1,330건·중복 38건·alias 275건)은 남아 있고 DQ-004는 `HG-004` 대기 |
| 사람 결정 필요 (`CATCHMEME_HUMAN_DECISION_REQUIRED`) | ⚠️ HUMAN_GATE 5건 대기. 다만 게이트 없이 진행 가능한 작업이 남아 루프는 계속 |
| 안전 중단 (`CATCHMEME_SAFETY_STOP`) | ❌ 해당 없음 |
| 반복 제한 | 3 / 12 |
