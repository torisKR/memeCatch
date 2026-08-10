# LOOP_STATE

> 루프 런타임의 영구 상태. 매 루프 시작 시 **이 파일을 먼저 읽는다.**
> 규격: 저장소 루트 `LOOP.md`

## 현재 루프

| 항목      | 값                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------- |
| 루프 번호 | **147** — PLUS-060 Global Daily → One-Cut Activation |
| 선택 항목 | 루프 147 `PLUS-060-GLOBAL-DAILY-ONE-CUT-ACTIVATION` — 완료한 Global Daily의 당일 검수 문항을 실제 One-Cut 실행으로 연결 |
| 상태      | `code_complete` — 당일 3문항·실제 content locale·safe/active·오늘 완료 상태를 서버에서 재검증한 One-Cut handoff와 existing Creator Pack/receipt 경로를 연결; authenticated Plus/RLS·payment·translation publication·production deploy는 human gate 유지 |
| 날짜      | 2026-08-10                                                                                     |
| 브랜치    | `main`                                                                                         |
| 산출물    | `artifacts/renewal/loop-001/` ~ `loop-147/`                                                    |

## 전체 목표

데이터 신뢰도와 화면 이해도를 동시에 높인다. 사용자는 상세 첫 화면에서 밈의 한 줄 뜻과
사용 신호를 이해하고, 각 주장의 근거·권리·마지막 검수 시점을 추적할 수 있어야 한다.
운영 조건은 1인 개발·운영이므로 유지보수 비용이 낮은 구조만 채택한다.

## 시스템 지도 (루프 001에서 확인)

| 영역           | 실제                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------- |
| 프레임워크     | Next.js 16.2.10 App Router · React 19.2.4 · Tailwind v4                                         |
| 패키지 매니저  | pnpm (`pnpm-lock.yaml`)                                                                         |
| 빌드           | `next build --webpack`                                                                          |
| 테스트         | `vitest run` — `**/*.test.ts(x)` (스크립트 일부는 `node *.test.mjs` 별도)                       |
| Lint           | `eslint` (eslint-config-next)                                                                   |
| 타입           | `tsc --noEmit` (별도 package script 없음 — 직접 호출)                                           |
| DB             | Supabase Postgres 17 (`onjipuldngbdptldkpoe`, ap-northeast-1)                                   |
| 마이그레이션   | `supabase/migrations/*.sql` 41개 — RLS 기본 deny + RPC 쓰기 경계                                |
| 배포           | Vercel (`vercel.json`)                                                                          |
| 크론           | `pg_cron` → `compute_trend_scores()` 일 1회 (최근 67회 전부 성공)                               |
| 분석           | GA(`NEXT_PUBLIC_GA_ID`) + `lib/analytics.ts`                                                    |
| Feature flag   | `lib/flags.ts` + `NEXT_PUBLIC_*` 환경변수                                                       |
| 관리자 검수    | `/admin/memes`, `/admin/sources`, `/admin/submissions`, `/admin/reports`                        |
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

|                            | 대표 콘텐츠 섹션 | iframe  |        폴백 히어로        | canonical |
| -------------------------- | ---------------- | :-----: | :-----------------------: | --------- |
| before (프로덕션)          | `대표 콘텐츠`    | ✅ 있음 |            ❌             | 유지      |
| after (로컬 프로덕션 빌드) | `대표 콘텐츠`    | ❌ 없음 | ✅ 「출처에서 원본 보기」 | 동일      |

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

| 문서                        | 근거     | before             | after                                        |
| --------------------------- | -------- | ------------------ | -------------------------------------------- |
| `e8ferq5u` 리부트 서버      | 0건      | 밈캐치 검수팀 확인 | ◌ 근거 출처 준비 중 + 제보 CTA               |
| `3fajbwre` 브금             | 맥락 1건 | 밈캐치 검수팀 확인 | ▲ 맥락 출처 1개로 확인 — 원본은 아직 찾는 중 |
| `z4ywt995` 임효준 귀화 논란 | 원본 5건 | 밈캐치 검수팀 확인 | ● 근거 출처 5개 확인                         |

canonical·robots·JSON-LD 구조 전부 불변. 데이터 미변경이라 `quality:check` 수치도 동일.

## 완료된 작업 (루프 004 — DES-001)

모바일에서 2단 그리드가 세로로 풀리면서 왼쪽 레일(대표 영상 662px)이 통째로 정보
앞에 왔고, 그 결과 첫 뷰포트(844px)에 이 밈의 뜻과 신호가 하나도 없었다.

- 정답 카드를 2단 그리드 **밖·위**로 올렸다. 모바일은 “뜻 먼저, 영상 나중”이 되고
  데스크톱은 제목이 전체 폭을 쓰는 헤더가 된다. 2단 구조 자체는 그대로다.
- `AuthInvite`(410px 로그인 유도)를 컴포넌트 문서가 명시한 자리인 “정답 카드 직후”로
  되돌렸다 — 기존 위치는 자기 문서와 어긋나 있었고 첫 화면을 먼저 차지했다.

**전후 비교** — `/memes/uefmryky`, 390×844

| 측정             | before |                                     after |
| ---------------- | -----: | ----------------------------------------: |
| 정답 카드 top    |   1344 | **79** (bottom 420 — 전체가 첫 뷰포트 안) |
| h1 top           |   1399 |                                   **216** |
| 한 줄 뜻 top     |   1435 |                                   **252** |
| 안전 신호 bottom |  ~1603 |                                   **399** |
| 대표 임베드 top  |    301 |                                       666 |

360×800 신규 측정도 동일 통과(정답 카드 79~420). 1440×900은 정답 카드가 전체 폭
헤더가 되고 그 아래 2단(미디어 left=160 w=495 | 정보 left=687 w=593)이 유지된다.

## 완료된 작업 (루프 005 — DES-003)

`doc-status-note.tsx`의 「{title}」을(를) 조사 placeholder가 사용자 화면에 그대로
노출되고 있었다. 이 배너는 공개 문서의 96.3%에 렌더되므로 사실상 전 사이트 노출이다.

- 조사를 붙이지 않는 문형으로 교체 — 「{title}」, 실제로 써 보셨다면 알려 주세요.
- **받침 판정 함수를 만들지 않았다.** 제목에 「보아 - No.1」·「12-3-30 챌린지」·
  「SK텔레콤 되고송」처럼 비한글로 끝나는 것이 섞여 있어 판정이 항상 옳게 나오지
  않는다. 문형을 바꾸면 판정 자체가 필요 없다.
- `doc-status-note.test.tsx` 신규 3건 — 이 컴포넌트의 첫 테스트다. 괄호 대안형 조사
  8종을 한 정규식으로 막는 회귀 가드를 포함해 재유입을 차단한다.

프로덕션 데이터로 확인: `/memes/uefmryky` 문서 전체 HTML에 괄호 대안형 조사 0건.

## 완료된 작업 (루프 006 — DES-002)

랭킹이 1·2·3위를 정확한 순위처럼 제시하면서 산정 기간도, 마지막 갱신 시각도, 표본
크기도 밝히지 않았다. 실측하면 최근 7일 총 조회가 308회(203개 문서)이고 상위 20개를
합쳐도 107회다 — **순위 1칸 차이가 조회 1~2회**다.

- `lib/ranking/methods.ts` 신규 — 세 탭의 기간·산식과 표본 임계치의 단일 출처
- 탭마다 `MethodNote`: 집계 기간 · 마지막 집계일 · 산식 한 문장 · (필요 시) 표본 경고
- 마지막 집계일은 `job_runs`가 운영자 전용 RLS라 읽을 수 없어, 공개 읽기가 열린
  `meme_trend_metrics`의 최신 `date`에서 얻는다
- 표본 임계치 = 1위 문서의 기간 내 조회 **30회**. 미만이면 “표본 적음”을 함께 밝힌다.
  트래픽이 늘면 경고는 자동으로 꺼진다.

**전후 비교** — `/rankings`

| 확인 항목   | before | after                                              |
| ----------- | :----: | -------------------------------------------------- |
| 산정 기간   |   ❌   | 집계 기간 최근 3일 / 최근 7일 (탭별)               |
| 마지막 갱신 |   ❌   | 마지막 집계 2026년 8월 4일 (DB `max(date)`와 일치) |
| 탭별 산식   |   ❌   | 3개 탭 각각 한 문장                                |
| 표본 부족   |   ❌   | ▲ 표본 적음 경고                                   |

## 완료된 작업 (루프 007 — DQ-008)

공개 문서 3,904건 전부 `year_precision='unknown'`인데 상세는 「{origin_year}년생 밈」
이라고 단정해 왔다 — 근거보다 세밀한 날짜 정밀도 표시(LOOP.md release blocker).

- `lib/labels.ts`에 `formatOriginYear(year, precision)` — `exact`·`year`일 때만 단정
- 데이터는 건드리지 않았다. 운영자가 정밀도를 올리면 자동으로 단정 표기로 복귀한다.
- `/memes/ra86attn` before 「2004년생 밈」 → after 「2004년생 밈 (추정)」
- 남은 범위(`[locale]` 상세 4개 로케일 + 카드 연도 칩)는 `DQ-011`로 등록

## 완료된 작업 (루프 008 — DQ-009)

루프 002에서 의도적으로 남겨 둔 렌더 경로↔쿼리 경로 불일치를 닫았다. 목록 화면
3곳이 PostgREST `.neq(…, "dead")`로만 걸러 `region_blocked` 썸네일이 탐색 그리드에
계속 노출되고 있었다.

- `UNAVAILABLE_FILTER`(= `UNAVAILABLE_STATUSES`에서 파생)를 추가하고 세 쿼리가
  `not.in.(dead,region_blocked)`를 쓴다 — 제외 목록의 단일 출처가 유지된다
- `/explore` 24개 · `/explore?platform=youtube` 24개로 회귀 없음
- 부수 수확: `withPublicContent`의 제네릭 제약이 `neq`만 갖고 있어 `tsc`가 잡았고,
  기존 테스트 1건이 “Shorts 필터에 `not` 호출이 없어야 한다”를 너무 넓게 단언하고
  있어 `meme_contents.url` 대상으로 좁혀 의도를 정확히 표현했다

## 완료된 작업 (루프 009 — PERF-001)

성능 회귀 검사가 루프 001부터 계속 `not_run`이었다. **의존성을 추가하지 않고** 이미
연결된 Chrome DevTools MCP의 performance trace로 기준선을 잡았다.

| route          | LCP (목표 2500ms) | CLS (목표 0.1) |
| -------------- | ----------------: | -------------: |
| `/`            |          143ms ✅ |        0.00 ✅ |
| `/rankings`    |         1062ms ✅ |        0.00 ✅ |
| `/memes/[key]` |         1131ms ✅ |    **0.12 ❌** |

**DES-001 전후 (상세 route)** — before(프로덕션) LCP 1308ms·CLS **0.21** →
after(로컬 프로덕션 빌드) LCP 1131ms·CLS **0.12**. CLS가 **43% 개선**됐다. 정답 카드를
그리드 밖으로 올리면서 외부 임베드가 본문 위에서 로드되며 텍스트를 밀어내던 구조가
사라진 결과다. 네트워크 조건이 달라 LCP는 엄밀한 비교가 아니다.

미측정(`not_run`): INP(트레이스에 상호작용이 없음), `/explore`, 필드 지표(CrUX 데이터
없음 — 트래픽 부족). 상세 CLS 0.12는 목표 초과라 `PERF-002`로 등록했다.

## 완료된 작업 (루프 010 — A11Y-001)

접근성 자동 검사도 루프 001부터 `not_run`이었다. PERF-001과 같은 방식으로 의존성
없이 Chrome DevTools MCP의 `lighthouse_audit`으로 기준선을 잡았다.

상세 route **Accessibility 97** (로컬·프로덕션 동일). 실제 위반은 1건이다.

| 실패 항목               | 판정                                            |
| ----------------------- | ----------------------------------------------- |
| `color-contrast` 2.82:1 | **실제 결함** → `A11Y-002`                      |
| `is-crawlable`          | 의도된 동작 — 얇은 문서 noindex (DQ-002/HG-001) |
| `third-party-cookies`   | 알려진 트레이드오프 — 공식 임베드               |
| `errors-in-console` 6건 | **로컬 계측 아티팩트** — 프로덕션은 0건         |

**프로덕션을 함께 측정한 것이 중요했다.** 로컬 프리뷰는 `next start`가
`.env.production`을 읽어 `NEXT_PUBLIC_SITE_URL`이 프로덕션을 가리키는데 페이지는
localhost에서 서비스돼 미디어가 교차 출처가 되고 CSP에 걸린다. 프로덕션에서는 동일
출처라 오류가 0건이다 — 대조하지 않았다면 없는 버그를 보고할 뻔했다.

잔여: 4개 route 중 1개만 측정했고 CI 자동 실행은 되지 않는다 → `A11Y-003`.

## 완료된 작업 (루프 011 — A11Y-002)

브랜드 accent 위 흰 글자가 WCAG AA를 통과하지 못했다(2.82:1, 요구 4.5:1).

**브랜드 색은 바꾸지 않았다.** 조사해 보니 `--accent-strong`(#d63c1b, white 대비
4.64:1)이 `app/globals.css:12`에 **이미** 정의돼 있었고 주석까지 “흰 글자 CTA
배경용”이라고 적혀 있었다 — 만들어 두고 쓰지 않던 토큰이었다.

- `bg-accent` + `text-white` + 14px bold 조합 **7곳**을 `bg-accent-strong`으로 교체
  (support 페이지, export-button ×2, changelog-modal, admin 2곳, inquiry-form)
- `bg-accent-soft`는 영향 없음. 큰 텍스트(3:1 기준)는 원래 통과라 손대지 않았다.

|                     | before |   after |
| ------------------- | -----: | ------: |
| Accessibility       |     97 | **100** |
| Agentic Browsing    |     96 | **100** |
| color-contrast 위반 |    1건 | **0건** |

## 완료된 작업 (루프 012 — PERF-002 조사)

**고치지 않고 원인만 규명했다.** DevTools `CLSCulprits`가 지목한 유일한 원인은 크기가
지정되지 않은 **쿠팡 제휴 광고 이미지**(`img1a.coupangcdn.com/.../ajax-loader.gif`)다.
즉 `PERF-002`와 `DES-004`는 같은 요소가 원인이고, 광고 배치 변경은 LOOP.md가
`HUMAN_GATE`로 규정한 항목이다(HG-005). → `PERF-002`를 `blocked`로 재분류했다.

**측정값이 실행마다 달랐다.**

| 실행     | 조건      |  CLS |
| -------- | --------- | ---: |
| 루프 009 | 콜드 캐시 | 0.12 |
| 루프 012 | 웜 캐시   | 0.00 |

광고 이미지가 캐시돼 있으면 늦게 들어오지 않아 이동이 없다. 루프 009의 0.12는 콜드
측정값이며 **단일 측정값으로 다루면 안 된다** — 앞으로 CLS는 콜드 캐시 기준 최악값을
여러 회 측정해 기록해야 한다. `BASELINE.json`에 이 단서를 남겼다.

## 완료된 작업 (루프 013 — DQ-011)

**backlog 항목이 과대 산정돼 있었다.** 루프 007에서 “`[locale]` 4개 로케일에도 같은
단정 표기가 있다”고 적었지만, 실제로 확인하니 이미 전부 헤지돼 있었다.

```
EN     Originated around {year}
JA     {year}年ごろに登場
zh-CN  约在{year}年出现
zh-TW  約在{year}年出現
```

실제 단정 표기는 `components/meme-embed.tsx:188`의 「{originYear}년 등장」 **하나**였다.
「{originYear}년 무렵」으로 바꿔 로케일판과 표현을 맞췄다. 정밀도를 prop으로 넘기지
않은 이유는 이 칩이 압축 라벨이고 「무렵」은 정밀도가 올라가도 참이기 때문이다.

의도적 제외: 퀴즈·주간 브리핑의 **맨 숫자 칩**(`2016`)은 문장 단위 주장이 아니라
라벨이다. 목록 UI마다 「(추정)」을 붙이면 잡음 대비 정직성 이득이 작다.

## 완료된 작업 (루프 014 — A11Y-003)

**axe를 추가하지 않았다.** 루프 011에서 실제로 터진 결함은 “AA를 만족하는 토큰이
이미 있는데 쓰이지 않았다”였다. 브라우저 전면 감사보다, 그 실패 양식을 정확히 막는
의존성 0 가드가 CI에 더 맞는다.

`lib/a11y-contrast.ts`(WCAG 대비 계산, 순수 함수) + 가드 2개를 `pnpm test`에 넣었다.

1. `--accent-strong`의 **모든 선언**이 흰 글자 대비 4.5:1 이상
2. 소스에 `bg-accent` + `text-white` 조합 0건

**두 가드가 실제로 실패하는 것을 증명했다.** 안티패턴을 재도입하니 파일:줄까지
지목하며 실패했고, 토큰 라이트 값을 밝게 바꾸니 2.34:1을 계산해 실패했다. 원복 후
둘 다 통과.

그 과정에서 **초기 구현의 구멍을 발견했다** — CSS 토큰의 마지막 선언만 보관해서
다크 값(#d63c1b)이 라이트의 결함을 가렸다. 일부러 깨뜨렸는데도 통과하길래 알았다.
선언마다 검사하도록 고쳤다. 실패를 증명하지 않았다면 구멍 뚫린 가드를 넣을 뻔했다.

범위 조정: 4개 route 브라우저 감사는 CI 헤드리스 러너가 필요해 비용이 크다. 전면
감사는 DevTools MCP `lighthouse_audit`(루프 010 절차)이 계속 담당한다.

## 완료된 작업 (루프 015 — 분석 이벤트 감사 + 체크리스트 마감)

루프 014에서 “READY 0”이라고 했지만 **backlog가 LOOP.md를 완전히 덮지 못하고 있었다.**
LOOP.md 「분석 이벤트」와 `RELEASE_CHECKLIST` 유지가 backlog에 아예 없었다.

**분석 이벤트: 13종 중 4종만 구현돼 있다.** 특히 `meme_source_opened`와
`correction_report_started`가 없어, **루프 003(근거 표시 정직화 + 제보 CTA)과 루프
006(표본 경고)이 참여를 해쳤는지 도왔는지 검증할 방법이 없다.** LOOP.md가 핵심
지표로 꼽은 「상세 → 출처 확인」·「상세 → 정정 제보」가 정확히 비어 있는 칸이다.

다만 이벤트 추가는 LOOP.md가 `HUMAN_GATE`로 규정한 「사용자 데이터 수집 범위 확대」다.
→ 명세·개인정보 검토까지만 만들고 `HG-006`으로 올렸다. `ANL-001`·`ANL-002` 등록.

**부수 발견(ANL-002):** 기존 `search_submit(query)`·`search_no_result(query)`가 **원문
검색어를 그대로 GA4로 보낸다.** LOOP.md는 원문 검색어 저장 전 개인정보 검토를
요구한다. 새 이벤트를 늘리는 것보다 이미 나가고 있는 이 값이 노출이 더 크다.

`RELEASE_CHECKLIST.md`를 루프 001 이후 처음으로 갱신해 5개 게이트 현황을 확정했다.

## 완료된 작업 (루프 016 — 체크리스트 잔여 검증)

backlog 밖에 남아 있던 `RELEASE_CHECKLIST` 게이트 C·D의 미검증 항목 중 실제 결함
가능성이 있는 두 건을 검증했다.

1. **순위 숫자 접근성 — 실제 결함, 수정.** `<span aria-label="1위">1</span>`은
   generic role이라 ARIA 명세상 aria-label이 지원되지 않는다. 무시하는 스크린리더는
   맥락 없는 "1"만 읽고, 존중하는 쪽도 구현에 따라 숫자와 라벨이 겹쳐 읽힌다.
   → `aria-hidden` 숫자 + `sr-only` 「N위」로 분리. LOOP.md §7의 마지막 미충족
   항목이 닫혔다.
2. **SSR 로딩 문구 — 결함 아님으로 해소.** 「랭킹을 불러오고 있어요」는
   `loading.tsx`의 `sr-only` 접근성 알림이고, 실제 순위 콘텐츠는 SSR HTML에
   존재한다. 루프 001 기준선에서 의심 표시했던 항목을 정상으로 판정.

## 완료된 작업 (루프 022~025 요약)

- **022** `SRCH-001` 기각 — 오타 후보 구현→실측→되돌림. 기존 RPC(trgm+초성+별칭)가
  이미 오타·자연어 질의를 흡수함을 실증.
- **023** 병렬 감사 30 에이전트 — **층화 표본 50건 직접 검토(최초 루프 §2 미이행분 완료)**
  - HG-001~~007 구현안 7건 + locale·코드·데이터 감사. 핵심 확정(전수):
    ① `usage_context.friends` 99.0% green — red 103건 중 84건도 green(HG-003 전제 갱신)
    ② `meme_contents` 100% embed — `media_type='image'` 1,364건을 뒷받침할 자산 0건
    ③ 출처 행 62.4%가 title·creator 없는 맨 URL — 화면이 「원본 확인」으로 과대 집계
    ④ 표본 18%가 밈 아님(전부 approved, 상위 trend 309~~335) → **HG-008 신규**
    ⑤ `meme_translations` 공개분 0 — [locale] 상세는 현재 사용자 노출 0(수리 적기)
- **024** 2차 병렬 30 에이전트 **실행 중** — 링크 생존 400·카테고리 층화 50·요약충돌
  100·신뢰 패널 설계 경쟁·§6~§10 감사 (완료 시 통합)
- **025** `DQ-013` — TrustNote 4단계 신설: 맨 URL뿐이면 「▲ 출처 링크 N개 수집 —
  서지 확인 중」. `uefmryky` 실측 전환 확인. 루프 003 과대 주장의 다음 층 해소.

## 진행 중인 작업 (루프 110 기준)

- **루프 110 `PLUS-034` 완료.** 글로벌 상세에서 확인된 `requested`·`in_review` 상태가 기존
  `/premium#plus-translation-fulfillment-title` 요청함으로 이어지며, malformed 2xx 응답은
  `unavailable` + retry로 닫힌다.
- 현재 활성 코드 편집은 없다. 이번 루프의 local code-complete 범위는 종료했으며, production payment·DB/RLS
  적용·번역 publication·OpenAI 호출·deploy/push/merge는 수행하지 않았다.

## 이전 상태 스냅샷 (루프 083 이전)

- ~~2차 병렬 함대~~ → **30/30 완료·통합됨.** 링크 부실률 2.5%(외삽 ≈115건, 나무위키
  집중) · 오염 카테고리 표본 not_meme 38%(1차와 수렴) · 요약-본문 충돌 0/100(가설 기각)
  · 신규 중복 3쌍 · 신규 backlog 후보 10건(최고 A11Y-012 터치 대상 45.0) · 신뢰 패널
  reader-first 승자 판정
- **배포**: renewal/loop-001 → main ff 병합, push 03c8468..b020214, Vercel 배포 확인
  (프로덕션 smoke 6/6). 이전 세션 미push 커밋 11개 포함됨.
- audit-synthesis 16건 backlog triage 대기
- **루프 026**: 최신 밈 7건(파라파라 챌린지·그린그린 레드레드·과자 사꾸·갸륵체·
  무마가가이·윤정아 챌린지·장시간 비행 밈)을 검수 대기(pending) 투입 SQL로 준비 —
  `artifacts/renewal/loop-026/pending-memes-import.sql`. 중복 20건 사전 대조 제외,
  출처 서지(DQ-013 기준) 포함, usage_context는 보수적 yellow 통일.
  **프로덕션 직접 쓰기는 권한 분류기가 차단** → 절대규칙 3의 드라이런 파일 경로로
  전환, 적용은 운영자 결정. **게이트 없이 진행 가능한 backlog가 0건이다** (체크리스트 잔여 검증 항목 중
  keyboard-only·768×1024·200% 확대·reduced-motion·INP·e2e는 남아 있으나 전부 결함
  증거가 없는 검증 부채로, 우선순위상 게이트 결정 이후로 미룬다).

## 이전 검증 결과 (2026-08-09 루프 122, `artifacts/renewal/loop-122/verification.md`)

| 검사 | 명령 / 표면 | 결과 |
| --- | --- | --- |
| focused regression | `pnpm exec vitest run lib/translation-worklist.test.ts lib/actions/admin-translations.test.ts components/admin/translation-coverage-panel.test.tsx components/admin/missing-translation-draft-preview.test.tsx` | ✅ **4 files / 30 tests** |
| 전체 단위/통합 테스트 | `pnpm test -- --reporter=dot` | ✅ **173 files / 1,196 tests** |
| 타입 | `pnpm exec tsc --noEmit` | ✅ 통과 |
| Lint | `pnpm lint` | ✅ 0 errors / 8 warnings (기존 warning) |
| 프로덕션 빌드 | `pnpm build` | ✅ Next.js 16.2.10 webpack, **81/81 static pages** (기존 metadataBase warning) |
| diff 무결성 | `git diff --check` | ✅ 통과 |
| 실제 표면 QA | `pnpm run plus:activation:local` + local Supabase HTTP | ✅ active/free/canceled/cross-owner, reviewed-current `en` receipt, retry idempotency, outcome summary, cleanup |
| 독립 리뷰 | Loop 122 `scripts/plus-activation-local.mjs` fresh `gpt-5.6-sol` high code reviewer | ✅ PASS — actionable finding 없음 |

## 현재 주요 위험

1. `ACT-001`의 production-like 결제→entitlement→one-cut→receipt는 격리 preview Supabase·결제
   테스트 자격증명·clean RC가 없어 실행할 수 없다. Loop 122의 local ACT-001-lite는 실제 로컬
   JWT/RLS/receipt 경로만 증명하며 결제나 production activation을 대체하지 않는다.
2. 글로벌 reviewed 번역 **448/1,520행은 historical intake artifact**이며, 사람이 제공한 pack의
   검수·SQL 적용·reviewed publication이 남아 있다. 이번 루프에서는 live 공급 수치를 다시
   확정하지 않았다. `LOC-010`은 공급 경로만 닫았다.
3. 데이터 품질 critical/backlog(무출처·중복·alias 충돌)과 실제 Supabase migration/RLS/JWT E2E는
   운영자 결정 및 production write gate 아래에 있다.
4. LSP diagnostics는 현재 사용할 수 없어 `tsc`, 테스트, lint, build를 대체 검증으로 사용했다.
5. 상황별 예문은 로컬 DTO 전달 경로만 닫혔다. 실제 글로벌 reviewed/current 행과 authenticated Plus 데이터를 확보하기 전에는 공급량·실제 사용자 표면을 주장하지 않는다.

## 다음 후보 작업 3개

1. `ACT-001` — clean RC·격리 preview·결제 테스트 자격증명과 reviewed/current 영어 fixture로 실제 payment→entitlement→one-cut→receipt를 검증한다.
2. `LOC-007` + `LOC-010` — 사람이 제공한 번역 pack을 intake하고 1,072행 잔여에 대해 complete gate를 재실행한다.
3. local RC/worktree consistency freeze — Loop 052~122 변경을 clean RC로 정리한 뒤에만 merge/push/deploy 판단을 한다.

**중단 조건 미충족.** 이번 루프의 local ACT-001-lite evidence는 확인했지만, full ACT-001·사람 번역 pack·데이터 품질
remediation은 별도 human gate다. 전체 리뉴얼 목표를 완료로 표시하지 않는다.

## 중단 조건 충족 여부

| 조건 | 충족 |
| --- | --- |
| 완료 (`CATCHMEME_RENEWAL_DONE`) | ❌ 전체 목표는 미완료. 데이터 품질·reviewed 번역 공급·production activation gate가 남아 있다. |
| 사람 결정 필요 (`CATCHMEME_HUMAN_DECISION_REQUIRED`) | ✅ ACT-001 자격증명/clean RC, 사람 번역 pack, production write/publication 승인 필요 |
| 안전 중단 (`CATCHMEME_SAFETY_STOP`) | ❌ 해당 없음 |
| 반복 제한 | 122 — ACT-001-lite local evidence 완료; production activation·translation/data remediation은 별도 gate |

### 이전 검증 결과 (루프 083 스냅샷)

| 검사                        | 명령 / 표면                                                                 | 결과                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| targeted Creator Pack      | `pnpm exec vitest run lib/plus-creator-pack.test.ts lib/plus-global-action-inbox.test.ts lib/plus-translation-fulfillment.test.ts lib/plus-translation-fulfillment.server.test.ts components/premium/plus-global-action-inbox.test.tsx` | ✅ **5 files / 25 tests** — order/cap/exact locale, fulfillment facts, native multi-file share, clipboard+download fallback, partial failure |
| 전체 단위/통합 테스트       | `pnpm test`                                                                  | ✅ **149 파일 / 966 통과**                                                                                |
| 타입                        | `pnpm exec tsc --noEmit`                                                     | ✅ 통과                                                                                                   |
| Lint                       | `pnpm lint`                                                                  | ✅ 0 error / 기존 warning 7개, Loop 083 신규 error 없음                                                  |
| 프로덕션 빌드              | `pnpm build`                                                                 | ✅ Next.js 16.2.10 webpack, **73/73 static pages**, Action Inbox completion/export routes 포함          |
| diff 무결성                 | `git diff --check`                                                           | ✅ 통과                                                                                                   |
| local/manual QA            | Playwright local production: `/en/pricing`, `/premium` | ✅ `/en/pricing` English Plus value/CTA rendered; `/premium` → `/login?next=%2Fpremium`; authenticated Plus populated/native share는 미검증 |
| production route inventory | build route output + existing export path | ✅ `/premium`, `/api/plus/action-inbox/complete`, `/memes/[key]/export` compiled; deploy는 수행하지 않음 |
| Supabase preflight          | migration/RLS/RPC status | `not_run` — 이번 루프는 새 DB 변경이 없고 실제 Supabase 적용·JWT E2E를 수행하지 않음                         |

### 이전 주요 위험 (루프 083 스냅샷)

1. ~~무출처 공개 문서가 “검수팀 확인”을 주장~~ → **루프 003에서 해소.** 다만
   1,330건에 실제 근거를 붙이는 일은 그대로 남아 있다(편집 작업, DQ-007).
2. **공개 문서의 96.2%가 충실도 미달**이라 색인 대상이 147건뿐이고, “아직 정리 중인
   문서예요” 배너가 사실상 전 문서에 뜬다. `components/doc-status-note.tsx`의 주석이
   경고한 “모든 문서에 붙는 순간 의미 없는 템플릿” 상태에 이미 도달했다.
3. ~~모바일 상세 첫 뷰포트에 밈 정보가 0~~ → **루프 004에서 해소**(정답 카드 top 79px).
4. **상황별 사용 신호의 84.8%가 4개 상황 전부 동일값.** 화면은 상황별 판정처럼
   보여주지만 데이터는 사실상 단일값이다.
5. **`meme_claims` 0건 · `meme_media.source_role` 100% `usage_example`.** 주장 단위
   근거 연결 설비가 스키마에만 있고 운영되지 않는다.
6. 로컬 `.env.production`의 `SUPABASE_SERVICE_ROLE_KEY`가 401을 반환한다(anon 키는
   정상 200). service_role을 쓰는 운영 스크립트가 지금 동작하지 않을 수 있다.
7. 루프 050 번역 worklist는 1,520행을 목표로 하지만 현재 오프라인 SQL 아티팩트는
   448행이다. 누락분은 번역 생성·검수 후 이어서 만들며, 부분 파일을 완결 배치로
   오인하지 않도록 `translation:check:complete`를 별도 게이트로 둔다.
8. **`SUB-001`의 production migration은 아직 적용하지 않았다.** 로컬 Docker가 없어
   DB lint/실행 검증을 못 했고, 적용 뒤에는 다음 예약 cron 실행과 Plus/비구독 RLS
   시나리오를 운영 환경에서 읽기 검증해야 한다.
9. **PLUS-017 활용 완료 migration은 아직 적용하지 않았다.** local API/UI contract는 통과했지만,
   active/expired/cross-owner JWT와 KST 중복 기록·연속 계산은 실제 Supabase에서 관찰하지 않았다.
10. **LOC-010은 공급 경로만 닫았다.** 실제 사람이 제공한 번역 pack이 없어 이번 루프에서
    448행을 늘리지 않았고, pack 검수·SQL 적용·reviewed CAS 발행은 여전히 운영 작업이다.
11. **PLUS-018 Creator Pack은 local contract까지만 닫았다.** 인증된 Plus의 실제 Action Inbox
    후보·PNG 응답·OS native share sheet는 계정과 production 배포가 없어 관찰하지 못했다.
    기존 Loop 082 intake는 canonical 기존 artifact 연결을 강화해야 한다는 review finding도 후속
    리스크로 남아 있다.

### 이전 후보 작업 3개 (루프 083 스냅샷)

1. `ACT-001` — clean RC와 격리 preview 권한을 확보한 뒤 실제 결제→entitlement→one-cut→receipt를 검증한다.
2. `LOC-007` + `LOC-010` — 사람이 제공한 번역 pack을 intake하고 1,072행 잔여에 대해 complete gate를 재실행한다.
3. `DQ-C1` + `DQ-C3/C4` — 출처 누락·중복·alias 충돌 데이터를 사람 검수와 production write gate 아래 정리한다.

**중단 조건 미충족.** PLUS-031과 LOC-018은 local code-complete 됐다. ACT-001의 preview Supabase·결제 테스트
자격증명·clean RC·reviewed/current 영어 fixture 부재, 사람이 제공한 번역 pack 부재, 글로벌 번역 448/1,520은
계속 human gate다.

### 이전 중단 조건 충족 여부 (루프 083 스냅샷)

| 조건                                                 | 충족                                                                                                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 완료 (`CATCHMEME_RENEWAL_DONE`)                      | ❌ **거짓 완료 선언을 하지 않는다.** `quality:check` critical 4개가 여전히 위반이다 — 화면 쪽 critical(DQ-005·DQ-001)은 해소됐지만 데이터 쪽(무출처 1,330건·중복 38건·alias 275건)은 그대로다 |
| 사람 결정 필요 (`CATCHMEME_HUMAN_DECISION_REQUIRED`) | ✅ `ACT-001`의 격리 preview DB·결제 테스트 자격증명·clean RC·reviewed/current 영어 fixture가 없다. |
| 안전 중단 (`CATCHMEME_SAFETY_STOP`)                  | ❌ 해당 없음                                                                                                                                                                                  |
| 반복 제한                                            | 106 — LOC-018 local discovery CTA 완료; production activation·translation/data remediation은 별도 gate                                                                              |

---

## 루프 046 — Web3 인터랙티브 리뉴얼 v2 (2026-08-04, 병렬 50 에이전트)

**SELECTED**: DES-WEB3-V2 — 사용자 직접 지시("web3 인터랙티브한 디자인으로 바꿔줄래?
병렬 에이전트로 50개 할당해서 구현해줘"). Signal Desk 문법을 전 페이지 인터랙티브
web3로 확장 — 보라 금지·flame 주색·cyan=실시간 신호 규칙은 유지.

**편성**: 정찰 6(디자인 5 + 데이터 품질 재측정 1) → 구현 35(파일 소유권 분할, 충돌 0건)
→ 검증 9(빌드·React·성능·a11y·코드·보안·카피·모션/CLS·문서). 총 50.

**변경**: globals.css 신규 유틸 6종(.glass-panel/.edge-signal/.text-signal/.holo-sheen/
.tilt-3d/.stat-mono) + 컴포넌트·페이지 ~100파일 스타일 전용 리뉴얼 + DESIGN.md §16.

**검증 게이트**: tsc 0오류 · eslint 0오류/6경고(기준선 동일) · vitest 634/634 ·
`next build --webpack` 성공(정적 64/64) · prod-preview(3100) 시각 QA 4 route.

**리뷰 발견→해소**: ①comments 글래스 GPU 비용(HIGH)→블러 없는 반투명 ②.hover-glow-flame
focus-visible이 Tailwind ring을 캐스케이드로 덮음(CRITICAL, 8지점)→셀렉터에서
:focus-visible 제거(근본 수정) ③언레이어드 유틸이 hover 보더 무력화(language-selector)
→shadow 기반 hover로 교체 ④"Live Signal" Title Case→Sentence case ⑤about 장식 인덱스
aria-hidden ⑥tilt-card rAF 언마운트 정리. 스타일 전용 계약 위반 0건(보안 리뷰 확인).

**데이터 품질 재측정**: critical 4지표 불변(무출처 1,330·dead 14·dup 38·alias 275),
공개 밈 3,904→3,906(+2/7일). 편집 작업은 여전히 HG-001~009 대기.

**잔여 디자인 부채(비차단)**: 색 토큰 문법 혼용(text-(--signal-cyan) vs
text-signal-cyan), TiltCard/.tilt-3d 미사용(어휘로 보존, DESIGN.md §16 문서화),
[locale] 출처 h2 위계 다운그레이드, CTN 축약 모호.

---

## 루프 047 — HUMAN_GATE 일괄 결정·실행 + 로컬 dev 완성 (2026-08-04)

**결정**: 사용자 위임("너가 직접 판단해서 결정해줘")으로 HG-001~009 전부 확정 —
DECISIONS.md 「결정 확정 (2026-08-04, 루프 047)」 표 참조.

**실행 완료 (병렬 8 에이전트 + 오케스트레이터 DB 적용)**:

- HG-001 C: MIN_PROSE_CHARS_INDEX=150 분리(사이트맵·robots·JSON-LD만) — 광고 게이트는
  contentDepth().isSubstantial(250)로 명시 분리(숨은 결합 해체). 색인 증가는 배포 후 재측정.
- HG-003 C: uniform-green(3,298건)만 「상황별 판정 미확인」 표시. uniform-red/yellow 12건
  (지잡대·떼카 등)의 확정 경고는 보존 — 제안서 §3 규칙 그대로.
- HG-004 C Phase1: R2 태그 backfill **프로덕션 적용 완료** — tags 22종·매핑 1,143행,
  재실행 신규 0(멱등), DQ-M2 3,906→2,887, 색인 147 불변(예측 일치). 롤백 SQL은
  artifacts/renewal/loop-047/tag-backfill-r2.sql 기준 제안서 §7. getRelatedMemes
  태그 조회에 trend_score 정렬 추가(§10 후속 처리).
- HG-005 C: 도크 실측 높이(131/151px) 스페이서 — SSR 첫 바이트부터 존재(CLS 해결 포함).
- HG-006 B: meme_source_opened·correction_report_started 추가, 검색어 64자 절단,
  /privacy 1줄 반영.
- HG-007 B/D: not-found 경계에 robots noindex 명시(상태코드 무관 색인 차단).
- HG-009(a) B: 카드에서 LifeGauge·SignalTrace 제거(안전+카테고리만).
- dev 환경: supabase/seed.sql 12건(카테고리 6×2, lifecycle·safety 각 3×4) + db reset
  검증 + NEXT_PUBLIC_SITE_URL 추가. 로컬 dev가 실콘텐츠로 렌더됨.

**실행 보류(결정은 확정)**: HG-002 B(168건 재판정 — HG-003 재판정과 묶은 배치),
HG-008 B(기준 명문화 선행), HG-009(b)(검수 시점 필드 신설 후).

**게이트**: tsc 0 / eslint 0 / vitest 646/646 / build 64/64.

---

## 루프 048 — 글로벌 피벗 Phase 1 (2026-08-04, 병렬 9 에이전트)

**지시**: 해외 K-밈 학습자 주 타깃·한국인 보조, SEO/GEO 구현, 영어 기반 노출.

**구현·배포**: ① `/` 언어 협상(proxy.ts) — 비한국어 첫 방문 302→/en·/ja·/zh·/zh-tw,
쿠키(memecatch_locale) 우선·봇 예외·Vary: Accept-Language ② hreflang x-default
ko→en 전환(홈·전역 — 밈 상세는 en reviewed 생길 때까지 ko 유지) ③ robots.ts에
GPTBot·ClaudeBot·Claude-Web·PerplexityBot·Google-Extended·CCBot 명시 허용
④ ko 상세 최상위 DefinedTerm JSON-LD ⑤ HG-008 실행: doc_class 컬럼(prod 적용)+
9건 event 재분류(prod 적용)+/editorial 기준 명문화+상세 배지 ⑥ 전역 크롬은 이미
4로케일 완비 확인(무수정).

**실측 발견**: 검수(reviewed) 영어 번역 0건이 국제화의 근본 병목 — /en 상세·
sitemap 로케일 URL·llms-full 전부 이 게이트에 걸림. 동적 llms.txt 시스템은 기존재.

**번역 배치**: MLX로 상위 18건 생성(artifacts/renewal/loop-048/en-translations-top20.sql,
멱등·자가검증). 운영 검수 판정: 승인 10 / 보류 8(로마자 오변환·표기 오류 —
generation-skipped.txt와 함께 기록). **DB 적용은 권한 분류기가 차단** — 사용자 실행 대기
(SQL Editor에서 아티팩트 실행 후 승인 10건 reviewed 승격).

**게이트**: tsc 0 / vitest 664/664 / build 64/64. 후속: en 상세 JSON-LD
translationOfWork(타 세션 파일 잠금 해제 후), 잔여 미번역 상위 398건 배치.

---

## 루프 049 — Claude 다국어 번역 배치 + admin 번역 검수 시스템 (2026-08-04)

**지시**: MLX 중단, Claude 직접 번역으로 전환("claude 로 모두 번역 교체해줘") + ja/zh/zh-tw
확장 + admin 검수 화면 + 배포. 검수 승격은 사용자 포괄 승인("너가 직접 모든걸 승인해줘").

**결과**: meme_translations reviewed **각 로케일 30건 × 4(en·ja·zh·zh-tw) = 120건** 프로덕션
적용. 전부 provider='claude', model='claude-fable-5', prompt_version=12. MLX 5건은 Claude
번역으로 교체(TWS·Seungkwan·Montjuic 오류 교정). 아티팩트: artifacts/renewal/loop-049/
{en,ja,zh,zh-tw}-translations-claude.sql (평문 SQL·멱등).

**admin**: /admin/translations 검수 큐 신설 — 기존 admin-translations 액션 재사용(경합 중복
구현 회피), 원문 대조·편집·승인/반려/삭제·감사 로그·CAS. 테스트 17/17.

**적용 방법 확립**: 긴 base64는 컨텍스트 전사 불가(loop-048 교훈) → 평문 SQL 2행 블록
아티팩트 + Read→execute_sql 슬라이스 파이프라인. reviewed 승격은 m.updated_at =
source_updated_at 신선도 가드 포함 일괄 UPDATE.

**후속**: 각 로케일 31번째 행(구 스모크 machine 1건씩)은 admin 큐에서 처리. 미번역 상위
문서 ~390건은 동일 파이프라인 반복.

## 루프 050 — 번역 SQL 배치 검증 게이트 (2026-08-04)

**선택 근거**: 루프 049의 후속 번역 배치가 `worklist.json`에 380개 문서를 선언했지만,
SQL 파일의 개수·중복·대상 문서·로케일 일치를 자동으로 확인하는 명령이 없었다. 번역
텍스트를 새로 만들거나 프로덕션에 쓰지 않고, 운영자가 SQL Editor에 적용하기 전 안전성을
검증할 수 있는 단일 수직 변경으로 범위를 고정했다.

**구현**: `scripts/translation-batch-check.mjs`와 테스트를 추가했다.

- `meme_translations` INSERT만 허용하고 `memes`·미디어·출처의 쓰기, 삭제·drop·truncate를
  거부한다.
- worklist 밖의 `meme_id`, 파일명과 행의 locale 불일치, 중복 `(meme_id, locale)`,
  conflict guard 누락을 오류로 보고한다.
- 기본 검사는 재개 가능한 **부분 배치**를 허용하고, `--require-complete`는 380×4
  행이 모두 생길 때만 통과하는 최종 게이트로 분리했다.

**현재 아티팩트 검증** (`translation-batch-check.json`):

| locale |            rows | missing from 380-doc worklist |
| ------ | --------------: | ----------------------------: |
| en     |             120 |                           260 |
| ja     |             140 |                           240 |
| zh     |              88 |                           292 |
| zh-tw  |              92 |                           288 |
| 합계   | **440 / 1,520** |                     **1,080** |

SQL은 읽기 전용으로 검사했으며 프로덕션 Supabase에 적용하지 않았다. 완결 전에는
`pnpm translation:check:complete`가 실패해야 하며, 이는 현재 의도된 상태다.

## 루프 050 검증 결과 (2026-08-04)

| 검사              | 명령                                              | 결과                                                                                   |
| ----------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 번역 checker 단위 | `node scripts/translation-batch-check.test.mjs`   | ✅ safeguards 통과                                                                     |
| 번역 부분 배치    | `pnpm translation:check`                          | ✅ 440/1,520행, 오류 0                                                                 |
| 번역 완결 게이트  | `--require-complete`                              | ⚠️ 의도된 실패 — en 260 / ja 240 / zh 292 / zh-tw 288 누락                             |
| 전체 단위 테스트  | `pnpm test`                                       | ✅ 80 files / 666 tests                                                                |
| lint              | `pnpm lint`                                       | ✅ 0 errors / 6 기존 warnings                                                          |
| 타입              | `pnpm exec tsc --noEmit`                          | ✅ 통과                                                                                |
| 프로덕션 빌드     | 네트워크 조건 `pnpm build`                        | ✅ 성공 (65 static pages)                                                              |
| route smoke       | `SMOKE_BASE_URL=http://localhost:3100 pnpm smoke` | ✅ 6/6, SEO-001 soft-404는 known issue                                                 |
| 글로벌 SEO/GEO    | 로케일·robots·sitemap·llms 읽기 검사              | ✅ en/ja/zh/zh-tw + GPTBot/ClaudeBot                                                   |
| 데이터 품질       | `pnpm quality:report` (anon GET)                  | ✅ 리포트 갱신, critical 수치는 기준선과 동일                                          |
| production 배포   | Vercel `dpl_FLKYjAS452tXtPtthTMGM7NcmGyU`         | ✅ `READY`, `catchmeme.com` aliases, 증적 `artifacts/renewal/loop-050/deployment.json` |

LSP 서버(`typescript-language-server`, `biome`)는 이 실행 환경에 설치되어 있지 않아
자동 LSP 진단은 수행하지 못했다. TypeScript·ESLint·빌드·테스트 명령은 별도로 통과했다.

배포 차이로 처음 production build가 실패했다. 로컬 `.codegraph` 심볼릭 링크가 Vercel
업로드 목록에 포함되지만 대상 경로는 배포 환경에 없었다. `.vercelignore`에 해당 로컬
메타데이터만 추가한 `f63442f`로 재배포했고, production 상태 `READY`와 canonical 도메인
스모크를 확인했다. 번역 SQL은 여전히 읽기 전용 오프라인 아티팩트이며 프로덕션 DB에는
적용하지 않았다.

## 루프 051 — 브랜치 정합성 감사와 안전한 SEO/GEO 병합 (2026-08-04)

`git branch -a -vv`, 각 worktree 상태, `main`과의 조상 관계를 대조했다. 완료된 renewal·
design·support 커밋은 모두 `main`의 조상이었다. 오래된 backup/brand 스냅샷과 loop-049
기능을 제거하는 `claude/upbeat-mendeleev-ec2a57` 스냅샷은 병합하지 않았다. 생성된
Playwright 로그와 untracked `pnpm-workspace.yaml`도 코드가 아니므로 가져오지 않았다.

`claude/affectionate-poitras-578f4c` worktree에 남아 있던 안전한 변경만 이식했다. reviewed
영어 번역이 있는 한국어 상세·sitemap의 `x-default`를 영어 URL로 연결하고, 번역이 없을
때는 한국어 원문을 유지한다. canonical은 계속 한국어 원문으로 유지하며 테스트 11건을
통과했다. 전체 감사 결과는 `artifacts/renewal/loop-051/branch-audit.json`에 남겼다.

| 검사              | 명령/증적                                      | 결과                                              |
| ----------------- | ---------------------------------------------- | ------------------------------------------------- |
| 브랜치 감사       | `artifacts/renewal/loop-051/branch-audit.json` | ✅ 완료된 변경 조상·stale WIP·dirty worktree 대조 |
| 전체 테스트       | `pnpm test`                                    | ✅ 81 files / 669 tests                           |
| 타입·lint         | `pnpm exec tsc --noEmit` · `pnpm lint`         | ✅ 타입 통과 / 0 errors / 6 기존 warnings         |
| production build  | `pnpm build`                                   | ✅ Next 16.2.10 / 65 static pages                 |
| production deploy | Vercel `dpl_8EGM72qLVPcNK3fLh3hrfcscyjvn`      | ✅ `READY`, `catchmeme.com` aliases               |

배포 증적은 `artifacts/renewal/loop-051/deployment.json`에 저장했다. 배포는 main 커밋
`36b1762`에서 수행했으며, production DB에는 쓰기 작업을 하지 않았다.

---

## 루프 052 — 글로벌 Plus 저장 밈 급상승 알림 (2026-08-08)

**선택 근거**: 병렬 점검에서 Plus가 개인화 피드·밈 저장·상세 추이·카테고리 알림을 각각
제공하지만, 사용자가 **직접 저장한 밈**이 다시 주목받는 순간을 알려 주는 닫힌 흐름은 없음을
확인했다. 이는 구독 가치가 화면 곳곳에 흩어져 보이지 않는 문제를 만들었다. `SUB-001`은 기존
entitlement, `saved_memes`, `trend_alerts`, daily trend pulse를 재사용해 1인 운영 비용을 늘리지
않는 단일 수직 변경이다.

**완료 조건**:

1. active Plus 사용자만 자신의 저장 밈이 `rising`일 때 `saved_rising` 인앱 알림 후보가 된다.
2. 저장 밈은 같은 실행에서 일반 관심사 `rising` 알림과 중복되지 않고, 사용자별 상위 15개 및
   `(user_id, meme_id, kind)` 멱등성·30일 보존 규칙을 지킨다.
3. 관심사 미설정 Plus 사용자도 저장 밈 알림 대상이며, 비구독자·브라우저는 fan-out을 호출하거나
   읽음 처리할 수 없다.
4. Plus 대시보드가 서버에서 계산한 저장 수만 표시하고, 메모·컬렉션 등 private metadata는
   노출하지 않는다.
5. Trend panel·alert bell은 현재 locale의 카피·숫자·detail 링크를 사용하며 public
   canonical/sitemap/metadata는 변하지 않는다.
6. 점수 계산이 끝난 뒤 매일 00:35 KST에 fan-out이 실행되도록 기존 pg_cron 패턴으로
   등록되며, 같은 이름의 기존 job을 교체해 재적용해도 중복 스케줄을 만들지 않는다.

**구현**:

- `20260808113000_plus_saved_meme_rising_alerts.sql`이 `saved_rising` kind와 security-definer
  fan-out을 추가했다. 후보는 active Plus user → own `saved_memes` → approved/limited rising meme
  순으로만 유도한다. 저장 밈은 category 후보에서 제외해 이중 알림을 막는다. 기존
  `compute_trend_scores()`가 끝난 뒤 5분 후(00:35 KST) 실행되는 named pg_cron job도 함께
  등록해, 호출되지 않던 fan-out 함수를 실제 일일 경로에 연결한다.
- 기존 글로벌 alert UI와 chart UI의 하드코딩 문구를 `PREMIUM_COPY`로 옮겼다. ko/en/ja/zh
  본번역과 나머지 지원 언어의 기존 fallback을 모두 통과한다. SEO 번역 로케일의 detail link는
  locale path를 유지한다.
- 대시보드는 저장한 밈 개수만 서버에서 count해 "저장한 밈 급상승 알림" 범위를 설명한다.
  불필요한 watch table·새 analytics·브라우저 쓰기 API를 추가하지 않았다.
- 독립 리뷰 후 Plus 만료 계정의 POST 읽음 처리도 403으로 차단했고, 차트 SVG gradient ID를
  `useId()`로 고유화했다. 30일 중복 억제 중에는 재알림을 보장하지 않으므로 카피에서 "다시"를
  제거해 실제 동작보다 강하게 약속하지 않는다.
- 글로벌 콘텐츠 경로도 함께 전진시켰다. linked Supabase CLI로 **읽기만** 하여 아직 번역이
  없는 두 문서를 확인한 뒤, en/ja/zh/zh-tw 각 2행의 AI machine draft를 오프라인 SQL로
  추가했다. SQL은 모든 원문 필드와 `updated_at` snapshot을 재확인하고 `(meme_id, locale)`에
  대해 멱등이다. `status='machine'`이라 사람 검수 전에는 공개되지 않으며, MLX 서버가 꺼져
  있었으므로 로컬 모델 호출은 하지 않았다. 증적: `global-translation-batch/`.

**남은 배포 전 검증/권한**: 로컬 Docker daemon이 없어 `supabase db lint --local`과 실제 DB
fan-out/RLS 실행은 하지 못했다. migration은 production에 적용하지 않았고, 적용 후 다음 예약
cron 실행 및 Plus/비구독/중복 시나리오를 운영자가 확인해야 한다. 이 항목은 코드 완료이지만
production 활성화 전까지 `in_progress`다.

## 루프 053 — 글로벌 Plus 전환 경로 정합성 (2026-08-08)

해외 방문자가 `/pricing`에서 언어를 바꾸면 기존에는 보장된 외국어 홈으로 이탈했고, 실제
`/en/pricing` 같은 경로는 존재하지 않았다. 반대로 가격 페이지의 canonical/OG는 한국어
하드코딩이었다. Plus가 개인 트렌드 레이더·무제한 저장·저장 밈 급상승 알림을 제공하더라도
글로벌 검색·공유·언어 전환에서 그 가치를 같은 언어로 설명하지 못하는 전환 단절이었다.

**구현**:

- `app/[locale]/pricing/page.tsx`를 추가했다. 상위 locale layout의 정적 locale만 허용해
  en/ja/zh/zh-tw 페이지를 prebuild하며, 각 페이지는 해당 `PREMIUM_COPY`의 title/intro와
  canonical·reciprocal hreflang·locale Open Graph·영어 x-default를 낸다. 한국어 `/pricing`도
  같은 metadata builder로 전환했다.
- sitemap은 가격 URL 5개를 하나의 language map으로 제출한다. `/pricing`와 모든 locale URL은
  동일한 `ko/en/ja/zh-Hans/zh-Hant/x-default` alternates를 가진다.
- `localizedStaticPath()`는 실제로 구현된 정적 route(`/`, `/pricing`)만 prefix한다. 따라서
  global selector, 브랜드 홈 링크, 가격 하단 링크, 저장 한도/차트 잠금의 Plus CTA가 언어
  문맥을 유지하면서도 `/th/pricing` 같은 존재하지 않는 route를 만들지 않는다.
- 결제 API·가격·자동 갱신 정책은 변경하지 않았다. 데이터·migration·배포·push·merge도 하지
  않았다. 실제 글로벌 결제 전환 측정은 배포 후 운영 지표로 확인해야 한다.

**검증**: 대상 routing/metadata/sitemap 회귀 40건과 전체 `pnpm test` **86 files / 686 tests**,
`pnpm lint`(0 error/기존 warning 7), `npx tsc --noEmit`, `pnpm build`, `git diff --check`를 통과했다.
증적: `artifacts/renewal/loop-053/`.

## 루프 054 — Plus Meme Vault (2026-08-08)

Plus는 무제한 저장과 folder/note를 이미 제공했지만, 저장 수가 늘면 원하는 밈을 다시 찾는
경로가 없었다. `/my`는 최근 저장순 50개 페이지만 보여 주며 제목·뜻·사용 신호로 찾을 수
없어, 구독의 핵심 재방문 자산이 목록에 묻히는 상태였다. 글로벌 사용자는 folder/note 편집
문구도 한국어로 보았다.

**구현**:

- `SUB-002` Plus Meme Vault를 `/my#saved`에 추가했다. Plus 전용 GET 검색은 저장한 밈의
  title/summary를 대상으로 하고, meme의 실제 green/yellow/gray/red 사용 신호를 함께
  필터한다. `memes!inner` + referenced-table filter로 필터가 embedded object만 비우는 것이
  아니라 owner의 saved row 자체를 줄인다.
- raw PostgREST `.or()`에 사용자 입력을 넣기 전에 Unicode 문자·숫자·공백·`_`·`-`만 남겨
  grammar injection을 차단했다. free 계정이 URL을 조작해도 서버에서 query/safety를 제거해
  기존 30개 저장만 보여 준다. 결과 수·원래 전체 수·검색/필터/pagination/clear 경로를 모두
  분리해 무제한 라이브러리의 현재 위치를 잃지 않는다.
- Vault controls, filtered-empty, Plus prompt, 그리고 기존 folder/note editor의 모든 fixed
  Korean copy를 `MY_COPY`로 옮겼다. global locale에서는 `/ja/pricing` 등 실제 localized
  pricing 경로로 연결된다.
- schema·saved row·billing·migration·배포·push·merge는 변경하지 않았다.

**검증**: Vault helper·MY copy·Vault component·editor 49건 및 전체 `pnpm test` **89 files /
694 tests**, `pnpm lint`(0 error/기존 warning 7), `npx tsc --noEmit`, `pnpm build`,
`git diff --check`를 통과했다. DB execution은 local Docker 부재로 아직 운영 릴리스 전
검증 항목이다. 증적: `artifacts/renewal/loop-054/`.


## 루프 055 — Localized Plus Export Upgrade (2026-08-08)

글로벌 사용자가 잠긴 고급 내보내기 옵션을 선택하면 CTA가 공용 대시보드 성격의 `/premium`으로
이동해, 루프 053에서 만든 언어별 가격·결제 설명 경로를 건너뛰고 있었다. 이는 고품질·무워터마크
내보내기라는 구독 가치를 선택한 직후 전환 맥락과 언어 문맥을 잃게 하는 작은 단절이었다.

**구현**:

- `GLO-002`로 `ExportButton`의 locked CTA를 `localizedStaticPath("/pricing", locale)` 단일
  helper에 연결했다. 따라서 ko/en/ja/zh/zh-tw는 실제 정적 가격 페이지를 사용하고, UI-only
  locale은 존재하지 않는 prefix 대신 cookie-localized `/pricing`을 유지한다.
- export modal의 닫기 버튼도 더 이상 고정 한국어 `aria-label`을 쓰지 않으며, 각 기본 UI locale의
  접근성 이름을 제공한다(zh-tw는 기존 Chinese fallback).
- billing entitlement·export route의 402 enforcement·가격·checkout·DB·migration은 변경하지
  않았다.

**검증**: targeted Vault/export 5 files / 50 tests 및 전체 `pnpm test` **90 files / 695 tests**,
`pnpm lint`(0 error/기존 warning 7), `npx tsc --noEmit`, `pnpm build`, `git diff --check`를
통과했다. 증적: `artifacts/renewal/loop-055/`.


## 루프 056 — Offline Translation Draft Boundary (2026-08-08)

글로벌 번역 배치는 448/1,520행의 reviewed-전 machine draft까지만 준비되어 있고 1,072행이
남아 있다. 기존 linked MLX 스크립트는 model 호출과 Supabase insert를 `--apply` 하나에 묶어,
생성 결과를 검토 가능한 SQL로만 남기는 안전한 재개 경로가 없었다.

**구현**:

- `LOC-007`에 `--emit-artifact --artifact-dir --slice`를 추가했다. 이 모드는 sitemap·linked
  Supabase의 **read-only** candidate query와 local MLX만 사용해 새 `locale-sliceN.sql`에
  source snapshot lock·`status='machine'` SQL을 append한다. DB SQL을 실행하지 않는다.
- Artifact directory의 기존 `(meme_id, locale)`을 먼저 파싱해 candidate에서 제외한다. 새 slice는
  exclusive create로만 열어 기존 검수본을 덮어쓰지 않는다. `--apply`와 artifact mode 동시 지정,
  불완전 artifact flags는 parser가 거부한다.
- 캐시된 Qwen 14B 모델을 실제로 시작해 artifact mode 1행을 시험했지만 첫 request에서 server가
  종료되어 `fetch failed`가 났다. 성공한 row는 없으며 header-only file은 즉시 제거했다.
  기존 `pnpm translation:check`는 448/1,520행을 그대로 통과한다.

**검증**: MLX script safeguard, translation checker, 전체 `pnpm test` **90 files / 695 tests**,
`pnpm lint`(0 error/기존 warning 7), `npx tsc --noEmit`, `pnpm build`, `git diff --check`를
통과했다. production DB·migration·deploy·push·merge는 수행하지 않았다. 증적:
`artifacts/renewal/loop-056/`.

## 루프 057 — Plus Saved Reuse Radar (2026-08-08)

Plus의 무제한 저장은 보관 용량만 늘렸을 뿐, 가입자가 다시 열어 볼 이유를 만들지 못했다.
루프 054의 Vault는 찾기 문제를 해결했지만, 지금 어떤 저장 밈을 쓰거나 확인해야 하는지는
사용자가 다시 판단해야 했다. 따라서 새 알림/추적 데이터 없이 기존 owner-scoped 저장 라이브러리를
현재 유행과 안전 신호로 실행 가능한 세 가지 행동으로 요약했다.

**구현**:

- `SUB-003`으로 `/premium`에 server-rendered Saved Reuse Radar를 추가했다. 인증된 server client가
  RLS 범위 안에서 `saved_memes` 최대 60개와 공개 `memes`의 trend/safety/lifecycle을 inner join하며,
  browser에는 별도 private fetch를 추가하지 않는다.
- pure helper는 green+rising/active만 **지금 써도 좋아요**, yellow+rising/active만 **맥락 확인**,
  나머지 gray/red·cooling·archived는 모두 **나중에 다시 보기**로 분류한다. 각 목록은 trend score →
  저장 시각 순으로 정렬하고 3개로 자른다. caution/unsafe 신호를 추천으로 바꾸지 않는다.
- empty library와 비어 있는 각 bucket도 다음 행동을 설명한다. `PREMIUM_COPY`의 ko/en/ja/zh와
  기존 fallback은 제목·상태·CTA 전부를 제공하며, UI-only locale route의 기존 semantics는 바꾸지 않았다.
- 가격표의 저장 혜택도 “무제한”만 말하지 않고 **saved-meme reuse radar**라는 현재 효과를 명시했다.
  saved row·billing·alert·schema/migration·배포·push/merge는 변경하지 않았다.

**검증**: targeted 5 files / 83 tests, 전체 `pnpm test` **92 files / 699 tests**, `pnpm lint`
(0 error/기존 warning 7), `npx tsc --noEmit`, `pnpm build`, `git diff --check`를 통과했다.
증적: `artifacts/renewal/loop-057/`.

## 루프 058 — Global Onboarding Recovery Path (2026-08-08)

Plus alert bell의 관심사 관리 CTA가 `/my/interests`라는 존재하지 않는 route를 가리키고 있었다.
개인화 alert을 쓰려는 글로벌 사용자는 404에 닿고, 실제 설정 경로 `/onboarding`도 한국어로만
보여 첫 개인화 입력을 완료하기 어려웠다.

**구현**:

- `GLO-003`에서 CTA를 실제 인증 경로 `/onboarding?next=/premium`으로 고정했다. 저장 뒤에는
  alert과 개인화 feed가 있는 Plus dashboard로 복귀한다. `safeNext`와 기존 server action은 그대로다.
- onboarding form은 `MY_COPY`의 supported-locale fallback을 사용한다. heading, hint, nickname,
  display categories, age radio group, skip, submit/pending을 모두 현재 locale로 렌더한다. 기존
  display-category → legacy category expansion은 변하지 않는다.
- dynamic `generateMetadata()`도 request locale copy를 재사용해 browser title/description의 Korean
  고정을 제거했다. profile write·auth policy·schema/migration·analytics·새 locale route는 추가하지 않았다.

**검증**: targeted 3 files / 45 tests, 전체 `pnpm test` **92 files / 700 tests**, `pnpm lint`
(0 error/기존 warning 7), `npx tsc --noEmit`, `pnpm build`, `git diff --check`를 통과했다.
증적: `artifacts/renewal/loop-058/`.


## 루프 059 — Localized Submission Flow (2026-08-08)

글로벌 사용자가 `/submit`에 도달해도 page/error/loading, form, link preview, TikTok import 상태와
server validation 응답이 고정 한국어로 나왔다. 제보는 사용자가 데이터를 보내기 직전의 흐름이므로
언어만 바꾸면서도 기존 인증·입력·URL·첨부 경계를 넓히지 않는 단일 수직 변경으로 닫았다.

**구현**:

- `SUBMIT_COPY`가 ko/en/ja/zh와 기존 fallback으로 page metadata, review/TikTok 상태, form/성공/
  upload/link-preview/error 카피를 제공한다. `/submit` page와 error/loading client boundary는 현재
  locale을 사용하며, 성공 pending badge도 호출자가 locale label을 넘겨 표시한다.
- server action은 form locale을 신뢰하지 않고 `getRequestLocale()`으로 validation/RPC 오류를
  현지화한다. Zod 제한, HTTPS URL 판정, server-side oEmbed 재검증, authenticated attachment prefix,
  rate limit/RPC mapping 및 TikTok OAuth/safe return은 유지했다.
- schema·migration·analytics·새 locale route·production database/content write·deploy·push·merge는
  추가하거나 수행하지 않았다.

**검증**: targeted 4 files / 28 tests 및 전체 `pnpm test` **96 files / 728 tests**, `pnpm lint`
(0 error/기존 warning 7), `npx tsc --noEmit`, `pnpm build`, `git diff --check`를 통과했다.
증적: `artifacts/renewal/loop-059/`.

## 루프 060 — Plus Meme Use Kit (2026-08-08)

사용자가 밈의 뜻을 읽은 뒤 실제 메시지나 게시물에 바로 활용할 수 있는 결과물이 부족했다.
기존 권한·데이터 경계를 바꾸지 않는 단일 수직 변경으로, 페이지에 이미 표시된 제목·뜻·사용 안내·주의·
유행 상태를 설명용·게시용·안전 체크용 세 문구로 조합하는 Plus 활용 팩을 추가했다.

**구현**:

- `lib/meme-use-kit.ts`가 새 사실을 생성하지 않고 전달받은 editorial fields만 deterministic하게 조합한다.
- `components/premium/meme-use-kit.tsx`는 Plus 사용자에게 세 문구와 전체 복사 버튼을 제공하고, 비구독자에게는
  locale-safe pricing CTA가 있는 잠금 preview를 보여준다.
- 한국어 상세와 `/en`, `/ja`, `/zh`, `/zh-tw` 상세에 같은 컴포넌트를 연결했다. Plus copy는 ko/en/ja/zh와
  기존 fallback 규칙을 사용하며, 제한 공개 문서에 대한 과장 표현은 넣지 않았다.
- migration·production database/content write·cron·deploy·push·merge는 추가하거나 수행하지 않았다.

**검증**: `pnpm exec vitest run lib/meme-use-kit.test.ts components/premium/meme-use-kit.test.tsx lib/i18n-premium.test.ts`
80 tests passed; `pnpm exec tsc --noEmit`; `git diff --check` passed.
증적: `artifacts/renewal/loop-060/`.

## 루프 061 — Global SEO Safety Hardening (2026-08-08)

글로벌 상세 페이지의 언어 대체 링크가 route마다 다른 기본 언어를 선택하고 있었고, 공개 밈 조회가
실패해도 sitemap이 정적 URL만 포함한 부분 결과로 성공할 수 있었다. 이는 번역 coverage가 부분인
현재 상태에서 검색엔진에 잘못된 대표 URL과 빈 발견면을 제공할 수 있는 안전 문제다.

**구현**:

- locale 상세 metadata가 reviewed/indexable 영어 버전이 있으면 영어 상세를 `x-default`로 사용하고,
  없을 때만 한국어 원문을 fallback으로 사용한다.
- locale 상세 metadata에서 번역이 없으면 명시적으로 `notFound()`를 호출해 한국어 본문 fallback을
  metadata에서 반환하지 않는다.
- sitemap의 공개 밈 페이지 조회 오류는 로그만 남기고 `break`하지 않으며, 오류를 던져 부분 sitemap
  성공을 차단한다.
- `SEO-001`의 실제 HTTP soft-404는 Next 16 loading/streaming 경계에서 계속 재현되어 해결로 표시하지
  않았다. `force-dynamic` 실험은 성능 비용 대비 404 개선이 없어 제거했다.

**검증**:

- locale metadata·sitemap targeted 30 tests passed.
- 전체 `pnpm test`: 99 files / 734 tests passed.
- `pnpm lint`: 0 errors, 기존 warning 7개.
- `pnpm exec tsc --noEmit`, `pnpm build`, `git diff --check` 통과.
- production-like local HTTP smoke: 6/6 통과. 정상 한국어·영어·일본어 상세, 가격 페이지, sitemap 995 URL을 확인했다.
- unknown `/memes/zzzzzzzz` 및 `/en/memes/zzzzzzzz`는 HTTP 200으로 남아 `SEO-001` known issue 경고로 기록됐다.

production DB·번역 SQL·cron·deploy·push·merge는 수행하지 않았다. 기존 Loop 052~060의 dirty worktree도
보존했다. 증적: `artifacts/renewal/loop-061/`.

## 루프 062 — Plus Saved Rising Alerts (2026-08-08)

Plus의 저장 기능을 보관함에서 재방문 루프로 확장했다. 기존 카테고리 급상승 알림만으로는 사용자가
직접 저장한 밈의 재상승을 발견할 수 없었기 때문에, 저장한 밈을 더 높은 의도의 `saved_rising` 신호로
알림함에 연결했다. 일반 관심사 알림과는 중복을 제거하고, 저장 메타데이터는 공개하지 않는다.

**구현**:

- `20260808113000_plus_saved_meme_rising_alerts.sql`이 active Plus 사용자의 own `saved_memes`만
  fan-out 후보로 삼고, 승인/제한 공개·최근 14일·`rising` 조건을 적용한다.
- 저장한 밈은 `saved_rising`으로 우선순위를 얻고 관심사 일반 알림과 중복되지 않는다. 사용자당 상위
  15개, `(user_id, meme_id, kind)` idempotency, 30일 보존, service-role 전용 fan-out과 매일 00:35 KST
  cron 계약을 유지한다.
- `/api/trend-alerts`와 `TrendAlertsBell`은 signed-out/non-Plus를 잠그고, Plus에게만 알림을 반환한다.
  saved/category 라벨·숫자·관심사 CTA를 현재 UI locale로 렌더하며 private saved metadata는 노출하지 않는다.

**검증**:

- route·bell·migration source contract targeted 3 files / 13 tests passed.
- 전체 `pnpm test`: 99 files / 737 tests passed.
- `pnpm lint`: 0 errors, 기존 warnings 7개; `pnpm exec tsc --noEmit`, `pnpm build`, `git diff --check` 통과.
- local production HTTP QA: signed-out `GET /api/trend-alerts`는 `200 {locked:true,reason:"signed_out"}`를 반환했고,
  `/sitemap.xml`은 200 / 995개 `<loc>`를 반환했다.
- `supabase db lint --local`은 Docker/로컬 Postgres daemon 미연결로 실행하지 못했다.

production migration·RLS/cron 실행 확인·번역 SQL 적용·deploy·push·merge는 수행하지 않았다. 기존 dirty
worktree와 Loop 061의 SEO-001 soft-404 및 데이터/번역 게이트도 그대로 보존했다. 증적:
`artifacts/renewal/loop-062/`.

## 루프 063 — Plus Action Queue (2026-08-08)

저장 밈 급상승 알림과 Saved Reuse Radar가 발견 신호를 제공해도 사용자는 다시 상세로 이동한 뒤
Meme Use Kit을 찾아야 했다. Plus의 실질적인 다음 행동을 한 화면에서 고를 수 있도록 기존 owner-scoped
Radar 결과를 `useNow`·`checkContext`·`review` 세 단계의 실행 큐로 연결했다.

**구현**:

- `lib/plus-action-queue.ts`가 기존 `buildSavedReuseRadar` 결과에서 각 상태의 최상위 한 건만 선택한다.
  새 사실·추천·안전 판정을 만들지 않고, 기존 editorial signal과 lifecycle만 재사용한다.
- `/premium`의 Plus dashboard에 실행 큐를 추가했다. 각 항목은 현재 locale의 상세 URL과
  `#meme-use-kit-title`로 직접 연결되어 발견→맥락 확인/활용 팩까지의 단계를 줄인다.
- 빈 저장함은 무의미한 추천 대신 `/explore` CTA를 보여주며, 한국어·영어·일본어·중국어 copy와
  `zh-tw` fallback을 제공한다.
- schema·saved row·billing·alert fan-out·production DB·배포는 변경하지 않았다.

**검증**:

- action helper/UI·Plus copy targeted tests 통과.
- 전체 `pnpm test`: 101 files / 741 tests passed.
- `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors/기존 warnings 7), `pnpm build`, `git diff --check` 통과.
- local production HTTP QA: `/en/pricing` 200, `/en/memes/ra86attn` 200 및 locked Meme Use Kit anchor,
  `/premium` signed-out 307 보호 확인. unknown detail 200 soft-404는 기존 SEO-001로 남음.

현재 production read-only audit에서는 `/en|ja|zh|zh-tw/pricing`가 모두 404, sitemap pricing URL 0개,
번역 448/1,520행, unknown detail 200으로 확인됐다. 이는 이번 로컬 변경이 아직 deploy되지 않았다는
증거이며, production write/deploy를 자동 수행하지 않는다. 증적: `artifacts/renewal/loop-063/`.

## 루프 064 — Plus Weekly Change Brief (2026-08-08)

Action Queue는 기존 상태 신호를 행동으로 연결했지만, 사용자가 “이번 주 무엇이 달라졌는가”를
확인하려면 개별 Trend Panel을 여러 개 열어야 했다. 기존 `meme_trend_metrics`의 KST 일별 기록을
읽어 저장 밈·관심사 후보를 비교하는 읽기 전용 Plus 주간 브리프를 추가했다.

**구현**:

- `lib/plus-weekly-brief.ts`가 최근 7일 KST 창에서 최소 두 날짜의 metric이 있고 trend delta가 양수인
  `green`·`rising/active` 후보만 최대 3개로 정렬한다.
- `/premium` 서버에서 owner-scoped saved rows와 profile interests의 공개 후보를 합치고, Radar에 이미
  노출된 밈과 최근 7일 `trend_alerts` 밈을 제외한다. saved row·user id·결제 정보는 DTO/클라이언트에
  노출하지 않는다.
- `PlusWeeklyDeltaBrief`는 `PREMIUM_COPY`의 ko/en/ja/zh와 `zh-tw` fallback을 사용하고,
  locale-safe 상세의 `#trend-panel-title`로 연결한다. 기록이 부족하면 일반 인기 밈으로 채우지 않는다.
- 새 schema·migration·RPC·cron·이메일·사용자 추적·production write는 추가하지 않았다.

**검증**:

- weekly helper/window·UI·copy targeted 6 files / 87 tests passed.
- 전체 `pnpm test`: 103 files / 746 tests passed.
- `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors/기존 warnings 7), `pnpm build`, `git diff --check` 통과.
- local production HTTP QA: `/en/pricing` 200, `/en/memes/ra86attn` 200 및 Use Kit anchor,
  signed-out `/api/trend-alerts` locked 200, `/sitemap.xml` 995 URL, `/premium` 307 login 보호 확인.

production은 여전히 `/en|ja|zh|zh-tw/pricing` 404·sitemap pricing 0·unknown detail 200이며, 이는
로컬 변경 미배포 상태다. SUB-001 migration/RLS/cron, LOC-007 번역 448/1,520, 데이터 quality critical과
SEO-001 soft-404는 계속 열린 게이트다. LOC-007의 14B MLX `--emit-artifact` 재시도도 검수 가능한
행 0건(헤더만 있는 임시 SQL)으로 끝났으며 결과물은 승격하지 않았다. 증적: `artifacts/renewal/loop-064/`.

## 루프 065 — 관리자 GPT-5.6 Sol high 검수 (2026-08-08)

관리자 검수 화면의 AI 경로를 Anthropic 고정 호출에서 GPT-5.6 Sol high로 통일했다. 번역 큐에서도
원문과 번역 초안을 대조한 교정본·발행 의견·신뢰도·검수 메모를 받아 폼에 채울 수 있게 했다.

**구현**:

- `lib/openai-review.server.ts`가 서버 전용 OpenAI Responses API 클라이언트를 제공한다. 모델 기본값은
  `gpt-5.6-sol`, reasoning effort는 `high`, Structured Outputs는 strict JSON Schema이며 `store=false`다.
- 기존 밈 편집·제보 AI 초안과 `/admin/translations`·밈 상세 번역 카드를 같은 GPT 호출 경로로 연결했다.
- 관리자 운영자 재인증·감사 로그를 유지하고, GPT 결과는 자동 저장·자동 게시하지 않는다. 번역 승인·발행은
  기존 CAS와 운영자 버튼을 통과해야 한다.
- 서버 환경변수는 `OPENAI_API_KEY`, 선택적 `OPENAI_REVIEW_BASE_URL`로 문서화했다. 관리자 검수 모델은
  `gpt-5.6-sol` + reasoning `high`로 고정해 오래된 `OPENAI_REVIEW_MODEL` 설정이 있어도 무시한다.
  현재 checkout과 production 환경에는 키를 쓰지 않았고, Vercel 환경변수·배포도 수행하지 않았다.

**검증**:

- GPT client·admin translation action·admin UI targeted: 4 files / 14 tests passed.
- 전체 `pnpm test`: 107 files / 756 tests passed.
- `pnpm exec tsc --noEmit`, `pnpm lint`, `git diff --check`는 오류 없이 통과했다.
- `pnpm build`는 compile·TypeScript까지 통과했으나 sitemap prerender에서 샌드박스 DNS가
  `onjipuldngbdptldkpoe.supabase.co`를 해석하지 못해 실패했다. 코드 오류가 아닌 원격 Supabase 접근 게이트다.
- 로컬 dev 서버 listen도 이 실행 환경의 `EPERM`으로 열 수 없어 관리자 브라우저 세션은 수행하지 못했다.
  대신 서버 클라이언트 요청 본문·응답 파싱·감사 로그·폼 채우기까지 mock 기반으로 확인했다.

production key 설정·실제 GPT 호출·번역 자동 승인·production deploy/push/merge는 수행하지 않았다.
기존 LOC-007 번역 448/1,520, SUB-001 migration/RLS/cron, 데이터 quality critical, SEO-001 soft-404도
그대로 열린 게이트다. 증적: `artifacts/renewal/loop-065/`.

## 루프 066 — Plus Saved Context Watch (2026-08-09)

Plus가 급상승·주간 추이만 보여주면 사용자는 저장한 밈의 안전 신호, 편집 내용, 번역 검수 상태가 바뀌었는지
직접 다시 확인해야 했다. 저장 시점 이후 공개 콘텐츠에 실제 변화가 생긴 경우에만 먼저 알려주는
`Saved Context Watch`를 추가해 구독 가치를 저장→변화→재검수 루프로 확장했다.

**구현**:

- `meme_public_change_events`가 편집·안전 신호·번역 검수/stale·유행 단계 변화만 기록한다. 트렌드 점수 전용
  배치 업데이트는 이벤트 트리거 대상에서 제외했다.
- `plus_saved_context_alerts`는 활성 Plus 사용자의 자기 저장 밈에 대해서만 fan-out되며, RLS·Plus 재검증
  `mark_saved_context_alerts_read()`·30건 상한·보존 기간을 갖는다. cron은 기존 일일 트렌드 작업 뒤인
  15:40 UTC에 실행되도록 추가했다.
- `/premium`은 현재 locale의 번역 상태와 저장 시각을 함께 보고, 마이그레이션이 아직 적용되지 않은 환경에서도
  stale/검수/편집 폴백을 렌더한다. 카드의 상세 링크는 locale-safe Meme Use Kit anchor로 연결되고, 모두 확인은
  `/api/saved-context-alerts`의 self-scoped RPC만 호출한다.
- ko/en/ja/zh와 `zh-tw` fallback copy, helper·migration·route·UI 회귀 테스트를 추가했다.

**검증**:

- 신규 targeted: 4 files / 13 tests passed.
- 전체 `pnpm test`: 111 files / 769 tests passed.
- `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors/기존 warnings 7), `git diff --check` 통과.
- `pnpm build`는 compile·TypeScript까지 통과했으나 sitemap prerender에서 샌드박스 DNS가
  `onjipuldngbdptldkpoe.supabase.co`를 해석하지 못해 실패했다.
- 승인된 로컬 dev server에서 실제 HTTP를 확인했다: signed-out `/premium`은 307으로 login에 보호되고,
  `POST /api/saved-context-alerts`는 401 `signed_out`를 반환했다. Plus 인증 세션과 실제 DB fan-out은
  자격 증명/production DB 없이 수행하지 않았다.

production migration·RLS/cron 적용·deploy·push·merge는 수행하지 않았다. 기존 LOC-007 번역 448/1,520,
SUB-001 migration/RLS/cron, 데이터 quality critical, SEO-001 soft-404 게이트는 계속 열려 있다.
증적: `artifacts/renewal/loop-066/`.

## 루프 067 — Plus Translation Priority Loop (2026-08-09)

Plus 사용자가 저장한 밈의 현재 locale 번역이 최신 검수본이 아닐 때 우선 검수를 요청하고,
운영자는 요청 수요가 큰 번역부터 Loop 065의 GPT 보조 검수와 기존 승인 절차로 처리하며,
완료 후 요청자는 Loop 066의 저장 밈 문맥 알림에서 결과를 확인하는 닫힌 흐름을 추가했다.

**구현**:

- locale 상세의 `TranslationPriorityButton`과 `/api/translation-priority`가 최신 reviewed 번역은
  재요청하지 않고, signed-out/free 계정·미저장 밈을 차단한 뒤 Plus 요청 상태를 조회·생성한다.
- `plus_translation_requests`는 사용자·밈·locale당 한 행을 유지한다. `request_plus_translation()`은
  활성 Plus, 자기 `saved_memes`, 공개 밈, en/ja/zh/zh-tw locale을 재검증하고 pending 요청을 사용자당
  20건으로 제한한다. 직접 insert는 열지 않고 self read·operator read/update만 RLS로 허용한다.
- `/admin/translations`의 수요 큐는 `(meme_id, locale)`별 요청 수와 최근 요청 시각을 집계해 요청 수
  내림차순으로 보여준다. 운영자가 검수를 열면 같은 번역의 requested 행을 `in_review`로 전환한다.
  GPT 결과는 Loop 065와 동일하게 자동 저장·자동 게시하지 않고 기존 운영자 승인/CAS를 유지한다.
- 최신 원문과 일치하는 reviewed 번역이 저장되면 요청을 `completed`로 바꾸고 `translation_reviewed`
  공개 변경 이벤트를 만든다. 활성 Plus 요청자에게는 Loop 066의 `plus_saved_context_alerts`로
  `(user_id, event_id)` 중복 없이 완료 알림을 연결한다.

**검증**:

- route·사용자 UI·관리자 action·migration source contract: 4 files / 20 tests passed.
- 전체 `pnpm test`: 114 files / 784 tests passed.
- `pnpm exec tsc --noEmit` 통과.
- `pnpm lint`: 0 errors / 7 pre-existing warnings. Loop 067의 `useEffect` dependency warning은
  `translationIsCurrent`를 dependency array에 반영해 남기지 않았다.

`20260809120000_plus_translation_priority_requests.sql`은 파일과 source contract만 검증했다.
실제 Supabase migration 적용, RLS/RPC/trigger의 DB 실행 검증, Plus 인증 세션의 end-to-end 확인,
production deploy·push·merge는 승인되지 않았고 수행하지 않았다. 따라서 이 루프는 로컬
`code_complete`이며 production 기능 완료로 선언하지 않는다. 기존 LOC-007 번역 448/1,520,
SUB-001 및 Loop 062·066 migration/RLS/cron, 데이터 quality critical, SEO-001 soft-404 게이트도
계속 열려 있다. 증적: `artifacts/renewal/loop-067/`.

## 루프 068 — Plus Daily Signal Email (2026-08-09)

Plus 감사에서 현재 대시보드는 사용자가 직접 방문해야만 급상승·저장 밈 변화·주간 브리프를 받을 수
있는 pull-only 구조로 확인됐다. 다음 반복 가치는 “놓치기 전에 도착하는 신호”로 정하고, 실제 이메일
provider 선택·credential 설정·production write는 별도 HUMAN_GATE로 남겼다.

**구현**:

- `plus_digest_preferences`는 signed-in 사용자가 명시적으로 수신 동의하고 `ko/en/ja/zh/zh-tw` 중
  수신 언어를 선택하도록 한다. 활성 Plus가 아니면 enable RPC가 거부되고, 끄기는 가능하다.
- `plus_digest_deliveries`는 `(user_id, delivery_date)`를 unique로 묶고 KST 날짜별 1회 원장을 만든다.
  service-role queue/claim/finish RPC만 쓰며, 30분 stale claim은 재처리할 수 있다.
- 일일 route는 `trend_alerts`의 최근 `saved_rising`을 먼저 선택하고 `rising`을 보충한다. 승인/제한 공개,
  rising, green/yellow만 포함하며 en/ja/zh/zh-tw는 현재 원문 revision과 일치하는 reviewed translation만
  메일에 넣는다. 각 항목에 locale-safe 상세 링크와 안전 신호를 포함한다.
- `/premium`에 수신 토글·수신 언어 UI를 연결하고 pricing copy에도 반복 가치와 수신 경계를 노출했다.
  `PLUS_DIGEST_DELIVERY_URL`·`PLUS_DIGEST_DELIVERY_TOKEN`·`PLUS_DIGEST_FROM_EMAIL`이 없으면 cron은
  `not_configured`로 종료해 DB claim이나 이메일 전송을 시도하지 않는다. relay payload에는 delivery id
  idempotency key를 포함한다.

**검증**:

- Daily Signal targeted: 7 files / 102 tests passed; full `pnpm test`: 120 files / 809 tests passed.
- `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors / existing warnings 7), `git diff --check` 통과.
- `pnpm build` production build 통과. metadataBase 관련 기존 warning만 남겼다.
- local HTTP QA: signed-out `GET /api/plus/daily-signal/preferences`는 401 JSON,
  signed-out `GET /api/cron/plus-daily-signal`는 401 JSON, `/admin/translations`는
  `/login?next=%2Fadmin%2Ftranslations`로 307 보호를 확인했다.

`20260809150000_plus_daily_signal_email.sql`의 실제 Supabase 적용·RLS/RPC 실행, relay credential 설정,
실제 발송·수신·unsubscribe, production deploy/push/merge는 승인되지 않았고 수행하지 않았다. 따라서
루프 068은 로컬 `code_complete`이며 production 기능 완료로 선언하지 않는다. LOC-007 번역 448/1,520,
Loop 062·066·067 migration/RLS/cron, 데이터 quality critical, SEO-001 soft-404 게이트도 계속 열린다.
증적: `artifacts/renewal/loop-068/`.

## 루프 069 — Global translation availability contract (2026-08-09)

현재 공개 번역 데이터가 부분 배치인 상태에서 한국어 canonical 상세가 다른 언어의 가용성을
알려주지 않으면, 사용자는 어떤 언어를 먼저 요청할 수 있는지 알 수 없다. 동시에 `llms.txt`가
machine/stale draft가 독자에게 보이는 것처럼 설명해 공개 reviewed-only 경계와 어긋났다. 이번 루프는
콘텐츠를 생성하거나 공개하는 대신, 기존 Plus 요청 경계와 공개 피드 정책을 한 vertical로 정합화했다.

**구현**:

- 한국어 밈 상세가 `getAvailableTranslationLocales()`로 현재 reviewed/current SEO locale을 확인하고,
  빠진 `en`·`ja`·`zh`·`zh-tw`만 글로벌 번역 요청 영역에 표시한다. 각 CTA는 기존
  `TranslationPriorityButton`과 `/api/translation-priority`를 재사용하므로 저장 밈·Plus·owner scope·
  공개 상태 검증은 서버 경계를 그대로 통과한다.
- `en`·`ja`·`zh`·`zh-tw`의 `llms.txt` 정책 문구를 machine/outdated draft는 운영자 비공개 워크플로에만
  남고 공개 페이지·검색·AI discovery feed에서 제외된다고 수정했다. public getter의
  reviewed/current/complete 정책과 설명을 일치시킨다.
- 번역 생성·검수 자동 승인·DB write·sitemap/hreflang·공개 SEO 범위·production deploy는 변경하지 않았다.

**검증**:

- 글로벌 detail bridge와 `llms.txt` route targeted: 4 files / 23 tests passed.
- 전체 `pnpm test`: 121 files / 815 tests passed.
- `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors / existing warnings 7), `pnpm build`,
  `git diff --check` 통과. build는 69/69 static pages 생성까지 완료됐고 기존 `metadataBase` warning만 남았다.
- `pnpm translation:check -- --json`: 448/1,520 rows, missing en=258·ja=238·zh=290·zh-tw=286.
  `pnpm translation:check:complete`는 추가 1,072행이 없어 의도적으로 실패했다.
- 로컬 HTTP에서 밈 조회가 Supabase `notFound`로 떨어져 새 missing-locale 패널을 데이터와 함께 관찰하지
  못했다. source contract·targeted test·build는 통과했지만 해당 화면의 authenticated Plus manual QA는
  미검증으로 남긴다.

실제 번역 생성/적용, Supabase migration·RLS/RPC 실행, GPT key 호출, production deploy/push/merge는
수행하지 않았다. 기존 데이터 quality critical, SEO-001 soft-404, 번역 완결 게이트와 Loop 062·066·067·068
DB-backed 운영 게이트도 계속 열린다. 증적: `artifacts/renewal/loop-069/`.

## 루프 070 — Plus collection brief export (2026-08-09)

기존 Plus는 저장 밈을 검색하고 신호를 확인할 수 있지만, 콘텐츠 후보를 만들거나 팀에 공유하려면
상세를 다시 열어 수동으로 정리해야 했다. 이번 루프는 이미 저장한 폴더를 실제 활용 산출물로 바꿔,
선택한 컬렉션을 비공개 Markdown 브리프로 내려받는 vertical을 추가했다.

**구현**:

- `/my#saved`가 Plus 사용자의 owner-scoped `saved_memes.collection` 이름을 모아 선택 목록으로 보여주고,
  `/api/plus/collection-brief` POST form으로 브리프 다운로드를 시작한다. 무료·비로그인 사용자는 기존
  entitlement 경계에서 차단된다.
- 브리프는 최대 100개의 `approved`/`limited` 공개 밈만 포함하며, 뜻·유래·사용 신호·유행 상태·
  현재 reviewed 번역·locale-safe 상세 링크·개인 메모·기존 Use Kit 문구를 담는다. 선택 locale의
  reviewed 번역이 stale/missing이면 이를 명시한 한국어 원문 fallback을 사용한다.
- 응답은 `text/markdown`, `attachment`, `private, no-store`, `nosniff`로 반환한다. 사용자 메모는
  다운로드 파일에만 들어가며 public page·검색·AI feed·새 DB write·migration은 변경하지 않았다.

**검증**:

- collection brief builder·route·My Vault UI·locale copy targeted: 4 files / 50 tests passed.
- 전체 `pnpm test`: 123 files / 822 tests passed.
- `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors / existing warnings 7), `pnpm build`,
  `git diff --check` 통과. build는 69/69 static pages와 `/api/plus/collection-brief` route를 생성했다.
- local HTTP QA: signed-out `/my`는 `/login?next=%2Fmy`로 307, signed-out collection brief POST는 401,
  `/en/pricing`은 200을 확인했다. 인증 세션·실제 saved folder가 없어 성공 attachment 다운로드와
  private note의 실제 브라우저 저장은 수동 관찰하지 못했다.

실제 Supabase migration/write, production deploy/push/merge, 인증된 Plus 데이터의 end-to-end 다운로드는
수행하지 않았다. 기존 번역 448/1,520·데이터 quality critical·SEO-001 soft-404와 Loop 062·066·067·068·069
운영 게이트는 계속 열린다. 증적: `artifacts/renewal/loop-070/`.

## 루프 071 — Plus in-app Daily Signal (2026-08-09)

Loop 068의 Daily Signal은 이메일 수신 동의·KST 원장·localized relay payload까지 준비했지만,
외부 relay credential과 Supabase migration이 없는 동안에는 Plus 사용자가 실제 급상승 콘텐츠를
대시보드에서 바로 확인할 수 없었다. 이번 루프는 같은 후보 계약을 MY PLUS에 추가해 구독자가
relay 설정 여부와 무관하게 현재 검수 신호를 소비할 수 있게 했다.

**구현**:

- `/premium`의 active Plus 서버 페이지가 최근 36시간 `trend_alerts`의 `rising`·`saved_rising`을
  읽고, 기존 `buildPlusDailySignalCandidates()`를 재사용해 저장 밈을 먼저 최대 3개로 정렬한다.
- 후보는 기존 이메일과 동일하게 `approved`·`limited`, lifecycle `rising`, safety `green`·`yellow`만
  허용한다. `en`·`ja`·`zh`·`zh-tw`는 `reviewed`이고 원문 revision과 일치하는 번역만 현지어 카드와
  locale-safe 상세 링크로 사용하며, 조건을 만족하지 않으면 그 후보를 억지로 원문 번역처럼 표시하지 않는다.
- `PlusDailySignal`은 empty 상태와 source·safety 문구를 5개 Daily Signal locale로 렌더링하고,
  free branch에는 component와 signal query를 전달하지 않는다. 이메일 설정은 기존 별도 opt-in 흐름으로 유지한다.
- 새 migration·write·외부 발송·공개 콘텐츠 생성은 추가하지 않았다. 데이터와 번역은 기존 RLS·reviewed/current
  publication gate만 읽는다.

**검증**:

- targeted: 4 files / 11 tests passed (`PlusDailySignal`, dashboard wiring, Daily Signal builder/delivery).
- 전체 `pnpm test`: 124 files / 825 tests passed.
- `pnpm exec tsc --noEmit` 통과.
- `pnpm lint`: 0 errors / 기존 warning 7개만 유지.
- `pnpm build`: webpack production build 통과, 69/69 static pages 생성, `/premium`·Daily Signal cron/API route 포함.
- `git diff --check` 통과.
- local HTTP QA: signed-out `GET /premium`는 `/login?next=%2Fpremium` 307, `/en/pricing`는 200 및
  `content-language: en`을 확인했다. 로컬 Docker daemon이 실행되지 않아 Supabase RLS/RPC와 authenticated
  Plus 성공 카드·실제 이메일 수신은 관찰하지 않았다.

실제 Supabase migration/RLS/RPC 적용, relay credential·발송/수신, production deploy/push/merge는
수행하지 않았다. 기존 번역 448/1,520·DQ critical·SEO-001 및 Loop 062·066·067·068·069·070 운영 게이트는
계속 열린다. 증적: `artifacts/renewal/loop-071/`.

## 루프 072 — Plus Global Meme Daily (2026-08-09)

Loop 071은 Plus 사용자가 현재 급상승 신호를 확인하게 했지만, 구독자가 매일 다시 방문해
검수된 글로벌 밈을 이해하고 직접 풀어보는 핵심 반복 사용은 없었다. 이번 루프는 KST 날짜를
기준으로 고정된 12개 후보에서 3문제를 제공하고, 완료·연속 기록을 서버에서 안전하게 기록하는
전용 Daily vertical을 추가했다.

**구현**:

- `/daily`, `/en/daily`, `/ja/daily`, `/zh/daily`, `/zh-tw/daily`를 추가했다. 로그인 전에는
  로그인 CTA, 무료 사용자는 localized pricing CTA, active Plus는 오늘의 3문제, 데이터가 없으면
  가짜 콘텐츠 없는 unavailable 상태를 보여준다. 대시보드와 pricing feature에도 진입점을 연결했다.
- `Asia/Seoul`의 날짜별 schedule은 공개 상태 `approved`/`limited`이며 제목·뜻·유래·설명이 있는
  밈 중 `en`·`ja`·`zh`·`zh-tw` 모두 `reviewed`·원문 revision current·필수 필드 complete인
  후보만 골라 12개를 고정한다. 어느 locale도 한국어 원문으로 위장해 fallback하지 않는다.
- 3문제는 날짜·locale·고정 후보 순서에 따라 deterministic하게 생성된다. 완료 API는 body에서
  `locale`만 받고 사용자·날짜·밈 ID는 세션과 schedule에서 서버가 결정한다. Plus entitlement와
  KST 현재 날짜를 RPC에서 재검증하며, 사용자/날짜당 한 번만 완료하고 streak를 계산한다.
- 새 migration은 `plus_global_daily_challenges`와 owner-scoped completion 원장, schedule 조회와
  completion RPC를 정의한다. 직접 table write는 막고 authenticated RPC만 노출하며, 실제 적용은
  운영자 승인 전까지 하지 않았다. `global_daily_start`·`global_daily_complete` 분석 이벤트도
  명시적으로 추가했다.

**검증**:

- targeted Global Meme Daily contract: **8 files / 125 tests passed**.
- 전체 `pnpm test`: **129 files / 852 tests passed**. `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors /
  기존 warning 7개), `pnpm build`(73/73 static pages), `git diff --check` 통과.
- local HTTP에서 `/daily`, `/en/daily`, `/ja/daily`가 200과 올바른 `content-language`·보안 헤더를
  반환했다. `/en/daily`의 `noindex, nofollow`와 signed-out 로그인 안내를 확인했고, 완료 API는
  invalid locale을 400으로 차단하며 private no-store/nosniff를 반환했다.
- Supabase Docker daemon이 없어 실제 authenticated Plus 성공, RLS 격리, migration/RPC 실행과
  DB reset은 관찰하지 않았다. production migration·deploy·push·merge도 수행하지 않았다.

기존 번역 448/1,520·DQ critical·SEO-001 및 Loop 062·066·067·068·069·070·071 운영 게이트는
계속 열린다. Loop 072의 코드는 `code_complete`지만 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-072/`.

## 루프 073 — Global Localized Meme Card Export (2026-08-09)

Loop 072는 글로벌 사용자가 검수된 밈을 매일 이해하게 했지만, 글로벌 상세에서 실제로 공유할 수 있는
Plus 산출물로 이어지는 마지막 단계가 끊겨 있었다. 한국어 상세에는 기존 카드 내보내기가 있었지만,
localized 상세에는 버튼이 없었고 서버 export는 canonical 한국어 제목·요약만 읽었다. 이번 루프는
새로운 콘텐츠 생성·자동 게시·데이터 모델을 추가하지 않고 이 수직 단절을 닫았다.

**구현**:

- `en`·`ja`·`zh`·`zh-tw` 상세 action grid에 기존 `ExportButton`을 연결했다. 버튼은 현재 SEO locale만
  `/memes/[key]/export?locale=...`로 전달하고, 한국어·UI-only locale은 기존 canonical 동작을 유지한다.
- export route는 `approved`·`limited` 공개 밈만 읽고, locale 요청 시 exact `reviewed` 번역의 필수 4필드와
  원문 `updated_at` revision 일치를 서버에서 다시 검증한다. missing·machine·stale·incomplete 번역에는
  한국어 PNG fallback 대신 404를 반환한다.
- `locale`이 지원되지 않으면 400으로 닫고, 성공 응답은 `image/png` attachment·`private, no-store`·
  `Content-Language`·`Vary: Cookie`·`nosniff`를 제공한다. proxy도 query locale을 canonical export의
  문서 언어로 보존해 글로벌 응답이 `ko`로 잘못 표기되지 않게 했다.
- 기존 Plus entitlement 게이트·classic/card 무료 export·premium template/story/scale 제한을 재사용했다.
  새 migration·DB write·service-role·외부 AI·미디어 복제는 없다.

**검증**:

- localized export route·proxy·button·localized detail targeted: **4 files / 27 tests passed**.
- 전체 `pnpm test`: **130 files / 859 tests passed**. `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors /
  기존 warning 7개), `pnpm build`(73/73 static pages), `git diff --check` 통과.
- production build를 로컬 `next start`로 기동해 실제 `/en` 상세(87,478 bytes)와 공개 영어 밈 export를
  관찰했다. `classic/card` 응답은 **200·52,282 bytes·PNG 1200×630**이며 `content-language: en`,
  `private, no-store`, `Vary: Cookie`, `nosniff`, attachment filename을 확인했다. `locale=fr`는 400,
  reviewed/current 번역이 없는 sitemap 밈은 404로 닫혔다.
- 인증된 Plus session으로 premium template·story·3x·무워터마크를 실제 다운로드하는 QA와 production
  deploy/push/merge는 수행하지 않았다. 기존 Supabase migration/RLS/RPC·번역 448/1,520·DQ critical·
  SEO-001 운영 게이트도 계속 열린다.

증적: `artifacts/renewal/loop-073/`.

## 루프 074 — Plus Daily Share Pack (2026-08-09)

Loop 073은 글로벌 상세에서 현지어 카드 PNG를 만들었지만, Plus 사용자가 Daily Signal을 보고 실제
공유까지 이어가는 흐름은 여전히 상세 재방문과 수동 복사에 의존했다. 이번 루프는 기존 신호 후보와
기존 카드 export를 조합해, 검수된 콘텐츠만 한 번의 사용자 동작으로 공유할 수 있는 private share
pack을 추가했다.

**구현**:

- `PlusDailySignalCandidate`에 `usageNote`, `caution`, `shareReady`를 추가했다. 서버는 원문 또는
  선택한 `dailySignalLocale`의 reviewed/current translation에서 `title`·`summary`·`description`·
  `origin`이 모두 채워진 경우에만 `shareReady`를 true로 만든다. 불완전한 후보는 신호 목록에는 남기되
  공유 CTA를 노출하지 않는다.
- `PlusDailyShareAction`은 후보의 서버 렌더링 데이터만 사용해 localized caption·safety note·상세 URL을
  조합한다. 같은 출처의 `minimal/card/1x` PNG를 same-origin export route에서 받아 파일 공유가
  가능하면 OS share sheet를 열고, 불가능하면 캡션을 clipboard에 복사한 뒤 PNG를 다운로드한다.
- export route는 기존 Plus entitlement·public moderation·reviewed/current locale gate와 새 localized
  card label map을 재사용한다. `Content-Language`, `private, no-store`, `Vary: Cookie`, `nosniff`를
  유지하며 402/404/503 응답에서는 share sheet를 열지 않는다.
- `gpt-5.6-sol`과 `reasoning.effort=high`인 관리자 GPT 검수 고정 계약은 변경하지 않았다. 새 migration,
  DB write, 외부 SNS API POST, 자동 게시, credential 변경은 없다.

**검증**:

- targeted share/export/signal contract: **6 files / 25 tests passed**.
- 전체 `pnpm test`: **133 files / 876 tests passed**.
- `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors / 기존 warning 7개), `pnpm build`(73/73 static pages),
  `git diff --check` 통과.
- 로컬 `next start` HTTP QA에서 `/en/memes/s66254dp-sticking-out-your-gyat-for-the-rizzler`는 200,
  `classic/card` 글로벌 export는 200·PNG 1200×630·`content-language: en`·private no-store·attachment를
  반환했다. Plus 전용 `minimal/card`는 signed-out 402, `locale=fr`는 400으로 닫혔다. PNG를 실제 이미지로
  열어 영어 tagline·safety·lifecycle 라벨이 렌더링되는 것도 확인했다.
- native OS share sheet와 인증된 Plus 성공 다운로드는 이 환경의 로그인 세션이 없어 unit test와 signed-out
  entitlement boundary까지만 검증했다. Supabase migration/RLS/RPC, production deploy/push/merge도 수행하지
  않았다.

기존 번역 448/1,520·DQ critical·SEO-001 및 Loop 062·066·067·068·072 운영 게이트는 계속 열린다.
Loop 074는 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-074/`.

## 루프 075 — Global Translation Desk (2026-08-09)

Loop 074까지 Plus 사용자가 검수된 글로벌 밈을 공유할 수 있게 했지만, 공개 글로벌 catalog의
번역 coverage가 로케일별로 얼마나 남았는지 관리자 화면에서 즉시 판단할 수 없었다. 기존
`/admin/translations`는 실제 번역 행만 페이지 단위로 보여 offline LOC-007 artifact의 448/1,520행과
현재 live public catalog를 혼동할 여지도 있었다. 이번 루프는 번역 생성·승인·공개를 자동화하지 않고,
글로벌 콘텐츠 공급을 안전하게 운영할 수 있는 coverage desk를 추가했다.

**구현**:

- `lib/translation-coverage.ts`가 public meme revision과 translation rows를 순수 함수로 받아
  `reviewed/current`, `machine/current`, `stale`, `missing`을 로케일별로 상호 배타적으로 분류하고
  완료율을 계산한다. source revision instant 불일치는 stored status보다 먼저 stale로 분류한다.
- `getTranslationCoverage()`는 operator를 재검증하고 `approved`·`limited` 밈만 분모로 읽는다.
  translation query도 `memes!inner`와 moderation filter를 사용해 operator가 읽을 수 있는 private 행이
  public coverage에 섞이지 않게 했다. 양쪽 조회는 1,000행 range pagination을 사용한다.
- `/admin/translations`에 `GLOBAL TRANSLATION DESK` 패널을 연결했다. machine/stale 수는 기존 검수
  queue로 이동하고 missing은 offline draft와 사람 검수가 필요하다고 표시한다. 조회 오류는 0건이
  아니라 unavailable 상태로 표시한다.
- coverage 경로에는 update/insert/delete·GPT 호출·claim RPC·revalidation·자동 게시가 없다. 기존
  `gpt-5.6-sol` `reasoning.effort=high` 보조 검수와 운영자 CAS 승인 경계를 유지했다.

**검증**:

- targeted coverage/actions/panel: **3 files / 14 tests passed**.
- 전체 `pnpm test`: **135 files / 883 tests passed**.
- `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors / 기존 warning 7개), `pnpm build`(73/73 static pages),
  `git diff --check` 통과.
- `pnpm translation:check`: **448/1,520 rows**, en=122·ja=142·zh=90·zh-tw=94; missing
  en=258·ja=238·zh=290·zh-tw=286으로 offline LOC-007 잔여를 별도 확인했다.
- 로컬 `next start`에서 signed-out `/admin/translations`는 **307** 및
  `/login?next=%2Fadmin%2Ftranslations`로 보호되는 것을 확인했다. security headers도 유지됐다.
- authenticated operator 200·live Supabase RLS/실제 1,000행 초과 페이지네이션·production deploy/push/merge는
  인증 세션과 로컬 Docker DB가 없어 수행하지 않았다. LOC-007 번역 생성·적용·자동 공개도 수행하지 않았다.

증적: `artifacts/renewal/loop-075/`.

## 루프 076 — Global Translation Draft Preview (2026-08-09)

Loop 075에서 live public catalog의 번역 누락 수를 확인할 수 있게 했지만, 운영자가 누락 원문을
선택해 번역 초안을 검토할 수 있는 다음 단계가 없었다. 이번 루프는 저장·발행 없는 휘발성 GPT
초안 미리보기만 추가해 글로벌 콘텐츠 공급 병목을 줄인다.

**구현**:

- `listMissingMemeTranslations()`는 operator를 재검증하고 `approved`·`limited` 공개 밈만 1,000행
  단위로 읽는다. 해당 locale의 모든 기존 `meme_translations` 행을 페이지네이션으로 수집해
  `machine`·`reviewed`·`stale`를 구분하지 않고 이미 존재하는 `(meme_id, locale)`를 후보에서 제외한다.
- `previewMissingMemeTranslationWithGpt()`는 명시적인 운영자 클릭에서만 호출된다. 원문 공개 상태와
  source revision, 번역 행 부재를 서버에서 확인한 뒤 기존 Responses API helper의
  `gpt-5.6-sol`·`reasoning.effort=high`·strict JSON schema·`store:false` 계약으로 source-only
  번역 초안을 만든다. GPT 호출 직후 원문 revision과 번역 부재를 다시 확인해 변경 중 결과는 폐기한다.
- `/admin/translations`는 locale을 선택했을 때만 missing 후보를 로드하고, UI는 title·summary·description·
  origin·usage_note·caution·aliases·recommendation·confidence·review_notes를 읽기 전용으로 표시한다.
  버튼 클릭 전에는 GPT를 호출하지 않으며 저장·감사 로그·재검증·발행을 수행하지 않는다.
- 기존 번역 검수/CAS 승인·공개 흐름은 변경하지 않았다. 누락 초안은 사람이 별도 검토·저장·발행해야
  하며, 자동 번역 적용·sitemap/hreflang 공개·새 migration은 이번 루프에 포함하지 않았다.

**검증**:

- targeted actions/coverage/preview UI: **4 files / 24 tests passed**.
- 전체 `pnpm test`: **136 files / 893 tests passed**.
- `pnpm exec tsc --noEmit`, 변경 파일 ESLint, `pnpm lint`(0 errors / 기존 warning 7개),
  `pnpm build`(Next 16.2.10 webpack, 73/73 static pages), `git diff --check` 통과.
- 로컬 production HTTP에서 signed-out `/admin/translations`와 `?locale=en` 모두 **307**으로
  `/login`에 redirect되고 `next`·CSP·nosniff·frame·referrer 보안 헤더가 유지됐다.
- authenticated operator 200, 실제 Supabase RLS·1,000행 초과 live pagination, 실제 GPT key 호출,
  production deploy/push/merge는 수행하지 않았다. 번역 448/1,520과 missing 1,072행은 그대로이며,
  이번 루프는 초안 preview만 제공하고 DB에 적용하지 않는다.

증적: `artifacts/renewal/loop-076/`.

## 루프 077 — Plus Global Scout Deck (2026-08-09)

Daily Signal은 최근 급상승 알림이고 Global Meme Daily는 퀴즈·완료 기록이므로, active Plus가 매일
검수된 글로벌 밈을 읽고 상세로 확인하는 발견 표면을 별도 read-only 덱으로 추가했다. 새로운 발견
목록을 더 늘리는 대신 기존 reviewed/current 공개 경계를 재사용해 글로벌 콘텐츠 공급 상태를 정직하게
표시하는 데 범위를 고정했다.

**구현**:

- `loadPlusGlobalScout()`는 active Plus에서만 public `approved`/`limited` 밈을 조회하고, `green`/`yellow`와
  `rising`/`active`를 적용한다. `ko`는 canonical source를 사용하고, `en`·`ja`·`zh`·`zh-tw`는 exact
  locale의 `reviewed`·source revision current·필수 4필드 complete translation만 사용한다.
- source를 최대 240개 overfetch한 뒤 KST 날짜와 source ID로 deterministic rank를 만들고 최대 5개를 안정적으로
  선택한다. 입력 순서와 무관하게 같은 날짜 결과를 재현하며 query 오류는 `unavailable`, 적격 후보 부재는
  `empty`로 분리한다.
- Premium 대시보드에는 safety/lifecycle·검수/현재성 증명·locale-safe 상세 링크를 노출한다. free branch는
  Scout query·ReactNode·카드를 만들지 않으며 저장·감사·RPC·AI·외부 게시·migration은 없다.

**검증**:

- targeted Global Scout contract: **4 files / 31 tests passed**.
- 전체 `pnpm test`: **139 files / 923 tests passed**. `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors /
  기존 warning 7개), `pnpm build`(73/73 static pages), `git diff --check` 통과.
- local production HTTP에서 signed-out `/premium`은 **307** login redirect와 CSP·nosniff·frame·referrer
  headers를 반환했다. authenticated Plus/live reviewed-current 후보와 production deploy는 미검증이다.

증적: `artifacts/renewal/loop-077/`.

## 루프 078 — Plus Reviewed Translation Fulfillment Center (2026-08-09)

Loop 077 감사에서 Plus 발견 surface는 충분하지만, 번역 요청이 사용자에게 다시 보이지 않아 운영자 검수와
글로벌 공급의 마지막 연결이 끊긴 것으로 확인했다. 이번 루프는 새 번역 생성이나 새 요청 API를 만들지 않고,
기존 `plus_translation_requests`·관리자 수요 큐·human CAS 공개 흐름을 owner-scoped 이행 센터로 연결했다.

**구현**:

- `buildPlusTranslationFulfillment()`가 `requested`·`in_review`·`completed`·`dismissed`를 deterministic하게
  정렬하고 최대 20건으로 제한한다. 완료 행은 exact locale translation이 `reviewed`이고
  `source_updated_at === memes.updated_at`일 때만 `ready`; 원문 revision이 바뀌면 `stale`로 표시한다.
- `loadPlusTranslationFulfillment()`는 active Plus와 명시적 `user_id`가 있을 때만 요청·번역 rows를 읽고,
  공개 밈·지원 locale·owner scope를 다시 적용한다. successful empty와 query `unavailable`을 구분하며,
  free/blank owner는 Supabase를 호출하지 않는다.
- `/premium`의 active Plus 대시보드에 요청함을 연결했다. 각 요청은 상태·시각·정확한 SEO locale 상세 링크를
  갖고, `en`·`ja`·`zh` 및 기존 `zh-tw` copy fallback을 사용한다. 기존 `/admin/translations`가 유일한
  claim surface이며 새 client DB query·write·RPC·AI·auto-publish는 없다.
- `plus_translation_requests_self_read` RLS를 owner identity뿐 아니라 `has_active_plus(auth.uid())`까지
  요구하도록 강화했다. operator read/update, request RPC, human-reviewed completion trigger는 유지했다.

**검증**:

- targeted fulfillment/UI/copy: **5 files / 102 tests passed**.
- targeted migration contract: **1 file / 8 tests passed**; self-read owner + active Plus 조건을 포함한다.
- 전체 `pnpm test`: **142 files / 937 tests passed**. `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors /
  기존 warning 7개), `pnpm build`(Next 16.2.10 webpack, 73/73 static pages), `git diff --check` 통과.
- local production HTTP에서 signed-out `/premium`과 `?locale=en`은 **307**으로 locale-preserving login에
  보호됐고, `POST /api/translation-priority`는 **401** 및 `private, no-store`와 보안 headers를 반환했다.
- authenticated Plus/operator rendering, 실제 Supabase migration/RLS/RPC/trigger, 실제 검수 완료 알림,
  production deploy·push·merge는 세션·Docker DB·운영 승인 부재로 수행하지 않았다.

기존 번역 448/1,520·DQ critical·SEO-001 및 Loop 062·066·067·068·072 운영 게이트는 계속 열린다.
Loop 078은 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-078/`.

## 루프 079 — Plus Alert Entitlement RLS Hardening (2026-08-09)

Loop 078의 애플리케이션 경계는 만료 Plus를 차단했지만, 직접 PostgREST select가 owner identity만
확인하는 두 private alert 정책은 별도 우회 경로를 남겼다. 이번 루프는 historical migration을 수정하지
않고 `trend_alerts`와 `plus_saved_context_alerts` self-read 정책을 owner + active Plus로 강화하는 forward
source contract만 추가했다.

**검증**:

- targeted RLS contract: **3 파일 / 14 tests passed**.
- 전체 `pnpm test`: **143 파일 / 942 tests passed**; tsc/lint/build/diff check 통과.
- migration은 `drop policy if exists` 후 재생성하는 idempotent SQL이며, browser write grant·RPC·service flow는
  변경하지 않았다. 실제 Supabase 적용과 active/expired/cross-owner JWT 관찰은 운영 게이트다.

증적: `artifacts/renewal/loop-079/`.

## 루프 080 — Plus Global Action Inbox (2026-08-09)

Plus의 Global Scout·Daily Signal·번역 이행 센터가 각각 분리된 다음 행동을 보여주던 문제를 하나의
server-derived inbox로 묶었다. active Plus에서만 최대 5개의 unique meme action을 만들고
`translation_ready > saved_signal > new_reviewed` 우선순위와 deterministic tie-break를 적용한다.

**구현**:

- `buildPlusGlobalActionInbox()`는 기존 fulfillment, share-ready Daily Signal, Global Scout를 재사용하며
  locale·trend·timestamp·ID를 기준으로 안정 정렬한다. duplicate meme은 가장 높은 우선 lane 하나만 남긴다.
- Premium 웹 요청 locale을 콘텐츠 locale로 사용하고, non-Korean action은 exact reviewed/current locale만
  링크한다. email preference locale은 기존 Daily Signal 설정으로 분리했다.
- fulfillment center는 `ready`만 localized detail link를 만들고 `requested`·`in_review`·`stale`·`dismissed`는
  상태만 표시한다. empty/unavailable와 partial lane failure를 구분한다.
- 새 table/RPC/cron/AI/client DB query/write/자동 게시/migration/deploy는 추가하지 않았다.

**검증**:

- targeted Action Inbox/fulfillment/dashboard: **6 files / 22 tests passed**.
- 전체 `pnpm test`: **145 files / 949 tests passed**. `pnpm exec tsc --noEmit`, `pnpm lint`(0 errors /
  기존 warning 7개), `pnpm build`(Next.js 16.2.10 webpack, 73/73 static pages), `git diff --check` 통과.
- local production HTTP에서 signed-out `/premium`과 `?locale=en`은 **307** locale-preserving login redirect,
  `/en/pricing`은 **200**을 반환했고 CSP·HSTS·nosniff·frame·referrer headers가 유지됐다.
- authenticated Plus/live Supabase inbox populated state, production migration/deploy/push/merge는 미검증·미수행이다.

기존 번역 448/1,520·DQ critical·SEO-001 및 DB-backed Plus 운영 게이트는 계속 열린다.
Loop 080은 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-080/`.

## 루프 081 — Plus Action Inbox Use Loop (2026-08-09)

Loop 080의 인박스가 발견·상세 이동만 제공해 구독자의 실제 활용과 재방문을 측정하지 못하던 공백을
기존 surface 안에서 닫았다. active Plus의 카드가 검수된 텍스트를 복사·공유하고 앱 안 활용 완료를
기록하며, 오늘 완료한 밈은 다음 인박스에서 제외한다.

**구현**:

- `buildPlusGlobalActionInbox()`가 server-derived completion summary와 오늘 완료 meme ID를 받아
  deterministic action 목록에서 완료 항목을 제외한다.
- Action card에 locale-safe share text, copy/share fallback, mark-used 버튼과 오늘 완료 수·연속 일수
  상태를 추가했다. 외부 SNS 게시를 완료로 표현하지 않는다.
- `POST /api/plus/action-inbox/complete`는 사용자·meme ID만 받고, 서버 entitlement와 UUID를 검증한 뒤
  completion RPC로 넘긴다. `get_plus_meme_use_summary`는 owner-scoped today IDs/count/streak를 읽는다.
- `20260809200000_plus_meme_use_completions.sql`은 KST 날짜별 복합키·owner + active Plus RLS·
  `security definer` 멱등 RPC를 정의하지만 이번 루프에는 적용하지 않았다.

**검증**:

- targeted: **5 files / 18 tests passed**.
- 전체 `pnpm test`: **148 files / 961 tests passed**; `tsc`, lint(0 errors / 기존 warning 7개),
  network-enabled build(73/73 static pages), `git diff --check` 통과.
- local production HTTP에서 signed-out `/premium`·locale-preserving login 307, `/en/pricing` 200,
  malformed completion API 400과 private/no-store/security headers를 관찰했다.
- 실제 Supabase migration/RLS/JWT E2E, authenticated Plus completion, production deploy/push/merge는
  미검증·미수행이다. 글로벌 번역 artifact는 여전히 **448/1,520**이며 MLX runtime blocker로 새 공급을
  만들지 않았다.

Loop 081은 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-081/`.

## 루프 082 — Artifact-first Translation Intake (2026-08-09)

번역 1,520행 worklist 중 448행만 존재하고 MLX runtime도 unavailable인 상태에서, 새 문구를
추측해 채우지 않고 사람/외부 편집자가 제공할 번역 pack을 안전하게 받는 수직을 추가했다.

**구현**:

- `scripts/translation-intake.mjs`가 JSON pack의 지원 locale, worklist membership, 밈별 4-locale
  completeness, duplicate `(meme_id, locale)`, 동일 source snapshot, 기존 target-language/source-fidelity
  validator를 검사한다.
- 기본 모드는 report-only다. `--emit-artifact`는 `--require-complete` 없이는 실행되지 않으며,
  locale별 SQL은 기존 `buildAtomicInsertSql()`을 사용해 source revision lock, 공개 상태, machine
  status, `reviewed_at = null`, conflict guard를 유지한다.
- `scripts/translation-intake.test.mjs`는 temporary pack을 실제 artifact로 만들고 기존
  `translation-batch-check`가 4행을 다시 읽는 end-to-end safeguard를 포함한다. 실제 번역 문구는
  repository artifact에 추가하지 않았다.

**검증**:

- `pnpm translation:intake:test`와 `pnpm translate:memes:mlx-linked:test` 통과.
- `pnpm translation:check`는 오류 없이 **448/1,520**을 보고했고, complete gate는 실제 누락
  `en=258`, `ja=238`, `zh=290`, `zh-tw=286`으로 의도적으로 실패했다.
- `pnpm test` **148파일 / 961 통과**, `pnpm exec tsc --noEmit`, `pnpm lint` 0 error/기존 warning 7개,
  `pnpm build` Next.js 16.2.10 webpack 73/73 static pages, `git diff --check` 통과.
- CLI help와 temporary artifact readback을 관찰했다. 실제 human pack, operator reviewed CAS publish,
  Supabase 적용, authenticated E2E, production deploy/push/merge는 수행하지 않았다.

Loop 082는 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-082/`.

## 루프 083 — Plus Creator Pack (2026-08-09)

Loop 081의 Action Inbox가 밈 단위 copy/share와 활용 완료까지 제공했지만, 여러 밈을 실제 게시 준비물로
묶는 마지막 행동이 없어 Plus 가치가 단건 사용에서 끊겼다. 이번 루프는 새 surface나 저장 모델을 추가하지
않고 기존 Action Inbox 안에 최대 5개 카드 Creator Pack을 연결했다.

**구현**:

- `lib/plus-translation-fulfillment.ts`와 server loader가 ready translation에 localized summary·usage/caution·
  source safety/lifecycle/trend facts를 전달하고, `lib/plus-global-action-inbox.ts`가 이를 action DTO에 담는다.
- `lib/plus-creator-pack.ts`가 기존 우선순위·중복 제거·완료 제외 결과를 입력 순서대로 최대 5개로 묶고,
  `buildPlusDailySharePack()`의 locale-safe caption/safety/export 경계를 재사용한다. 불완전 facts와 private-shaped
  extra fields는 pack에서 제외한다.
- `components/premium/plus-global-action-inbox.tsx`가 기존 Action Inbox 안에 Creator Pack CTA를 제공한다.
  파일 share가 가능하면 통합 caption과 PNG 묶음을 native share하고, 아니면 caption을 한 번 복사하고 성공한
  PNG를 개별 다운로드한다. 일부 export 실패는 성공/실패 수로 표시하며 자동 게시하지 않는다.
- ko/en/ja/zh/zh-tw copy와 acceptance/backlog/decision/release evidence를 연결했다. 새 migration/RPC/cron/
  DB mutation/외부 SNS POST는 추가하지 않았다.

**검증**:

- targeted Creator Pack/fulfillment/action inbox: **5 files / 25 tests passed** — deterministic order/cap,
  exact locale facts, native multi-file share, clipboard+download fallback, partial export failure.
- 전체 `pnpm test`: **149 files / 966 tests passed**; `pnpm exec tsc --noEmit`, `pnpm lint`(0 error / 기존 warning 7개),
  `pnpm build`(Next.js 16.2.10 webpack, 73/73 static pages), `git diff --check` 통과.
- Playwright local production에서 `/en/pricing`의 English Plus value/CTA render를 확인했고, `/premium`은
  `/login?next=%2Fpremium`으로 보호됐다. 인증된 Plus populated Action Inbox·실제 PNG export·OS native share는
  계정/production deploy 부재로 미검증이다.
- Supabase migration/RLS/RPC 적용, live DB, production deploy/push/merge, 실제 외부 게시는 수행하지 않았다.
  글로벌 번역은 여전히 **448/1,520**이며 LOC-010 human pack/operator CAS gate가 열려 있다.

Loop 083은 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-083/`.

## 루프 084 — Plus Creator Pack Outcome Receipt (2026-08-09)

Loop 083의 Creator Pack은 여러 밈을 캡션·안전 문구·PNG로 준비했지만, 사용자가 실제로 활용을 마친 뒤에도
기존 KST 활용 원장과 연결되지 않았다. 이번 루프는 새 원장이나 자동 완료를 만들지 않고, 성공적으로 준비된
카드만 사용자의 명시적 확인으로 기존 `POST /api/plus/action-inbox/complete`에 순차 제출한다.

**구현**:

- `PlusGlobalActionInbox`가 Creator Pack export 성공 항목을 임시 receipt로 유지한다. Pack 생성·공유·다운로드만으로는 활용 완료 API를 호출하지 않는다.
- receipt의 명시적 확인 시 성공한 meme만 기존 completion API에 기록하고, 실패 항목은 receipt에 남겨 다시 시도할 수 있다. 기존 카드의 개별 완료와도 중복되지 않도록 성공 항목을 함께 제거한다.
- `lib/plus-global-action-inbox.ts`가 ready translation을 현재 요청 콘텐츠 로케일과 일치할 때만 inbox에 넣는다. 다른 언어의 번역 링크가 현재 화면에 섞이지 않는다.
- ko/en/ja/zh Premium copy에 receipt 준비·완료·부분 실패·재시도 상태를 추가했다. 새 migration/RPC/cron/DB schema/외부 SNS POST/자동 게시를 추가하지 않았다.

**검증**:

- targeted current-locale/receipt UI: **2 files / 13 tests passed** — 다른 로케일 ready translation 격리, 생성 전 no-write, 명시적 완료, 부분 완료 실패 보존·재시도 CTA.
- 전체 `pnpm test`: **149 files / 969 tests passed**; `pnpm exec tsc --noEmit`, `pnpm lint`(0 error / 기존 warning 7개), `pnpm build`(Next.js 16.2.10 webpack, 73/73 static pages), `git diff --check` 통과.
- Playwright local production에서 `/en/pricing` 200·English Plus value/CTA를 확인했고, `/premium`은 `/login?next=%2Fpremium`으로 보호됐다. 인증된 Plus populated receipt·실제 API/RLS·native share는 세션 부재로 미검증이다.
- 글로벌 번역은 **448/1,520**이며, Loop 082 canonical intake guard와 human pack/operator CAS publish는 다음 후보·운영 게이트로 남겼다. Supabase 적용·production deploy/push/merge는 수행하지 않았다.

Loop 084는 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-084/`.

## 루프 085 — Unifi 정산 fail-closed 권한 무결성 (2026-08-09)

Loop 084 이후 병렬 검토에서 Unifi provider 응답의 핵심 필드가 비어 있어도 후속 검증 객체로 넘어갈 수
있는 경계가 확인됐다. 이번 루프는 결제 상품·구독 화면을 확장하지 않고, 결제가 Plus 권한으로 전환되는
서버 경계를 malformed response에서 닫았다.

**구현**:

- `getUnifiPayTransaction()`이 `transactionId`, `orderId`, `storeId`, finite `orderAmount`,
  `orderCurrencyCode`를 모두 요구하고, 응답 transaction ID가 요청 ID와 다르면
  `unifi_pay_status_invalid_response`로 실패한다.
- `isExpectedUnifiPayTransaction()`도 방어적으로 필수 식별자·상태·금액·통화를 다시 요구하고,
  configured store·USD·상품 금액과 정확히 일치할 때만 true를 반환한다. 기존 부분 검증의 빈 값 통과를 제거했다.
- webhook에서 provider status 조회 실패는 retryable 500 settlement failure로 남기고, 조회는 성공했지만
  store·금액·통화가 다른 거래는 200 ignored로 처리한다. 권한 생성·외부 게시·migration·DB schema 변경은
  추가하지 않았다.
- `gpt-5.6-sol` + `high` 관리자 검수 계약과 `store: false`는 그대로 유지했으며 이번 루프에서 AI 검수 호출을
  실행하거나 자동 발행하지 않았다.

**검증**:

- targeted Unifi parser/webhook: **2파일 / 30 tests passed** — 필수 필드 누락, transaction ID 불일치,
  malformed status lookup 500, mismatched store·amount·currency 200 ignored, 권한 미생성을 확인했다.
- 전체 `pnpm test`: **149파일 / 976 tests passed**; `pnpm exec tsc --noEmit` 통과; `pnpm lint` 0 error / 기존
  warning 7개.
- `pnpm build`는 네트워크 제한 환경에서는 sitemap의 Supabase 공개 조회 DNS 실패로 중단됐으나, 네트워크 권한으로
  재실행해 **Next.js 16.2.10 webpack 73/73 static pages**와 build trace를 생성했다. 기존 `metadataBase`
  warning은 유지된다.
- 로컬 production HTTP에서 `/en/pricing` **200**, 인증 없는 `/premium` **307 → `/login?next=%2Fpremium`**를
  확인했다. 실제 Unifi 결제·authenticated Plus/RLS·Supabase write·production deploy/push/merge는 실행하지 않았다.
- 글로벌 번역은 여전히 **448/1,520**이다. canonical intake/review-safe translation handoff와 실제 공급 보완은
  다음 운영 후보로 남겼다.

Loop 085는 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-085/`.

## 루프 086 — Locale-safe Plus 개인 트렌드 레이더 (PLUS-021, 2026-08-09)

비한국어 Plus 사용자가 한국어 원문 카드와 한국어 상세 링크를 받는 문제를 이번 한 수직
변경에서 닫았다. 새 dashboard panel이나 번역 생성기를 추가하지 않고, 기존 `MyFeed`를
실제 검수 콘텐츠 경계에 맞췄다.

**구현**:

- `lib/plus-localized-feed.server.ts`를 `server-only` loader로 분리했다. Plus 조기 반환
  뒤에는 쿠키 없는 `createStaticClient()`만 사용하며, session-aware `createClient()`나
  private DB read를 사용하지 않는다.
- `ko`는 기존 source 카드·6개 제한을 유지한다. `en`·`ja`·`zh`·`zh-tw`는 source를
  최대 60개 overfetch한 뒤 exact locale `reviewed`·current·필수 prose/slug 행만
  투영한다.
- 기존 `overlayMemeTranslation()` + `isIndexableLocalizedMeme()`를 재사용해
  `description`, `origin`, `usage_note`, `caution`, examples, source/content/tag depth와
  공개 상태가 localized detail route와 같은 기준을 통과한 카드만 노출한다.
- 관심사 0개는 의도된 fresh 선택으로 정의하고, 성공한 관심사 빈 결과만 fresh로 폴백한다.
  관심사 조회 실패는 fresh로 숨기지 않는다. `empty-source`, `empty-coverage`,
  `unavailable`을 별도 상태로 표시한다.
- UI-only locale은 명시적으로 English content로 표시하고 `/en/...` 경로를 사용한다.
  `zh-tw` feed 상태 문구는 간체 fallback과 별도의 번체 블록이다. 카드 category/safety
  chrome의 완전한 번역은 이 루프의 약속에 포함하지 않았다.

**검증**:

- focused: **4 files / 104 tests passed** — projection, server loader, MyFeed rendering,
  5-locale copy 및 `zh-tw` 전용 블록.
- 전체 `pnpm test`: **152 files / 993 tests passed**.
- `pnpm exec tsc --noEmit` 통과; `pnpm lint` 0 error / 기존 warning 7개;
  `git diff --check` 통과.
- `pnpm build`: Next.js 16.2.10 webpack **73/73 static pages** 통과.
- local production HTTP: `/en/pricing` **200**, unauthenticated `/premium` **307 →
  /login?next=%2Fpremium**, `/my` **307 → /login?next=%2Fmy**.

이번 루프는 migration/RPC/cron/DB write/번역 발행/외부 게시/production deploy를 실행하지
않았다. 현재 translation checker 수치는 **448/1,520**이며, authenticated Plus populated
feed와 live reviewed/current DB 후보는 운영 QA 대기다. 다음 후보는 (1) Plus 첫 화면의
“오늘의 밈 1개 완성” command center, (2) human translation intake/CAS publish, (3) 실제
market passport 데이터 공급이다.

Loop 086은 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-086/`.

## 루프 087 — Plus 오늘의 활용 결과 (PLUS-022, 2026-08-09)

Plus의 핵심 기능들이 개인 피드·Daily Signal·Global Scout·Action Inbox로 분산되어 있어,
구독자가 첫 화면에서 오늘 무엇을 끝내야 하는지 직접 조합해야 했다. 이번 루프는 새 데이터
모델이나 추천 산식 대신 이미 검수된 Action Inbox와 Creator Pack을 하나의 결과 흐름으로
승격했다.

**구현**:

- `PremiumDashboardContent`에서 Action Inbox를 첫 업무 영역으로 이동했다. Daily Signal,
  Global Scout, localized feed 등 근거·탐색 표면은 뒤에 유지한다.
- `PlusGlobalActionInbox`에 순수 상태 판정 `ready | prepared | complete | empty | unavailable`를
  추가했다. 초기 완료 수가 있거나 마지막 카드를 명시적으로 완료하면 작은 성공 문구 대신
  “오늘의 결과 완료” 상태가 남는다.
- Creator Pack 생성·공유·다운로드는 기존처럼 completion API를 호출하지 않는다. 성공 카드만
  receipt에 남기고, 사용자가 확인 버튼을 누를 때만 기존 owner-scoped completion API를 호출한다.
  부분 실패 항목과 재시도 경계는 유지한다.
- 결과 상태 문구를 `ko`·`en`·`ja`·`zh`·`zh-tw`에 추가하고, Traditional Chinese는 전용
  Action Inbox copy block으로 분리했다. touched CTA는 44px 기준(`min-h-11`)으로 맞췄다.
- active Plus가 이미 Plus 전용 Daily에 들어와 있는데도 보던 upgrade CTA를 첫 문제 시작 CTA로
  바꿨다.

**검증**:

- focused: **3 files / 98 tests passed** — Action Inbox 상태·receipt 전이, dashboard 순서·active
  CTA, 5개 locale copy.
- 전체 `pnpm test`: **152 files / 995 tests passed**.
- `pnpm exec tsc --noEmit` 통과; `pnpm lint` **0 errors / 기존 warning 7개**;
  `pnpm build` Next.js 16.2.10 webpack **73/73 static pages** 통과; `git diff --check` 통과.
- `pnpm translation:check`: **448/1,520** (en 122, ja 142, zh 90, zh-tw 94; 누락 1,072행).
- local production HTTP: `/zh/pricing` **200**, `/zh/daily` **200**, unauthenticated
  `/zh/premium` **307 → /login?next=%2Fpremium**, `/zh/my` **307 → /login?next=%2Fmy**.

이번 루프는 migration/RPC/cron/DB write/번역 발행/외부 게시/production deploy를 실행하지 않았다.
실제 authenticated Plus populated Action Inbox·Creator Pack/native share·live RLS는 세션과 DB
fixture가 없어 운영 QA 대기다. 번역 공급량과 데이터 critical gate도 그대로 유지한다.

Loop 087은 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-087/`.

## 루프 088 — Plus 번역 수요 → machine 초안 브리지 (PLUS-023, 2026-08-09)

Plus 번역 요청이 운영자 우선순위 큐에 쌓여도, 번역 행이 아직 없으면 `검수 열기`가 빈
상세 페이지로 이동했고 기존 GPT 미리보기는 읽기 전용에서 멈췄다. 이번 루프는 이 수요를
실제 검수 큐까지 전달하는 한 수직만 닫았다.

**구현**:

- 번역 priority queue에서 `translationStatus === null`인 요청은 해당 로케일과 밈 ID를
  가진 `/admin/translations` 집중 경로로 이동하고, 기존 행이 있는 요청은 기존 claim·상세
  검수 경로를 유지한다.
- `listMissingMemeTranslations`에 집중 밈 조회를 추가해 최신 20개 목록 밖의 Plus 요청도
  누락 원문으로 정확히 열 수 있게 했다.
- `MissingTranslationDraftPreview`에 GPT 결과를 운영자가 직접 수정하는 편집 폼과
  `검수 대기 초안 저장` 버튼을 추가했다. 미리보기는 계속 no-write이며, 버튼을 누를 때만
  `meme_translations`의 단일 `machine` 행을 만든다.
- 저장 액션은 operator 권한, 공개 원문 상태, 기대 source revision, 중복 행을 다시
  확인한다. `localized_slug`는 번역 제목에서 결정적으로 만들고, `provider=openai`,
  `model=gpt-5.6-sol`, `prompt_version=1`, `reviewed_at/reviewed_by=null`을 보장한다.
  감사 로그와 관리자 경로만 재검증하며 공개 경로·sitemap·Plus ready 소비자를 갱신하지
  않는다.

**검증**:

- focused: **2 files / 20 tests passed** — source-only preview no-write, explicit edited
  machine insert/audit/CAS, UI edit/save/no-auto-save.
- 전체 `pnpm test`: **152 files / 996 tests passed**.
- `pnpm exec tsc --noEmit`: 통과.
- `pnpm lint`: **0 errors / 기존 warning 7개**.
- `pnpm build`: Next.js 16.2.10 webpack **73/73 static pages** 통과. 첫 sandbox 시도는
  Supabase DNS 제한으로 sitemap prerender가 중단됐고, read-only 네트워크 권한 재시도에서
  통과했다. metadataBase 기존 warning만 남았다.
- `pnpm translation:check`: **448/1,520**; en=122, ja=142, zh=90, zh-tw=94,
  missing=1,072.
- `git diff --check`: 통과.

이번 루프는 migration/table/RPC/cron, production DB write, 번역 발행, 외부 게시,
production deploy/push/merge를 수행하지 않았다. 실제 authenticated operator 화면과
live Supabase insert는 세션·운영 승인 게이트로 남긴다. `machine` 행은 공개·Plus ready가
아니며 기존 인간 검수에서 reviewed로 승인되어야 한다.

Loop 088은 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-088/`.

## 루프 089 — Plus 번역 수요 claim 연속성 (PLUS-024, 2026-08-09)

Loop 088에서 누락 번역 요청을 GPT 검수 desk로 보낼 수 있게 됐지만, `초안 만들기` 링크가
Plus 수요 요청을 `in_review`로 claim하지 않아 운영 큐의 상태와 실제 작업이 어긋날 수 있었다.
이번 루프는 이 상태 경계만 닫았다.

**구현**:

- `translationStatus === null`인 priority row도 기존 `claimTranslationPriority`를 먼저 호출한다.
- claim이 성공한 경우에만 `/admin/translations?locale=<locale>&focus=<memeId>`로 이동한다.
- claim이 실패하면 운영자 큐에 남아 오류를 표시하고 GPT 검수 경로로 이동하지 않는다.
- 기존 translation row의 claim → `/admin/memes/<memeId>` 경로는 유지한다.
- GPT 검수 호출은 기존 계약대로 `gpt-5.6-sol`, `reasoning.effort=high`, strict JSON, `store=false`를
  사용하며 자동 저장·자동 발행으로 변경하지 않았다.

**검증**:

- focused: `components/admin/missing-translation-draft-preview.test.tsx` **7 tests passed** — 누락
  row claim 후 focus route, claim 실패 정지, 기존 preview/edit/save 회귀.
- 전체 `pnpm test`: **152 files / 998 tests passed**.
- `pnpm exec tsc --noEmit`: 통과.
- `pnpm lint`: **0 errors / 기존 warning 7개**.
- `pnpm build`: Next.js 16.2.10 webpack **73/73 static pages** 생성.
- `pnpm translation:check`: **448/1,520**; en=122, ja=142, zh=90, zh-tw=94, missing=1,072.
- `git diff --check`: 통과.
- local production HTTP: signed-out `/admin/translations` **307 → `/login?next=%2Fadmin%2Ftranslations`**;
  security headers 유지.

**운영 경계**:

이번 루프는 migration/table/RPC/cron, production DB write, 실제 번역 발행, 외부 게시,
push/merge/deploy를 수행하지 않았다. authenticated operator session·live Supabase claim/GPT call·
machine→reviewed 승인·1,072행 번역 보완은 운영 게이트로 남긴다. 현재 글로벌 공급 수치는
**448/1,520**이며, `machine` 행은 reviewed/current 전까지 공개·sitemap·Plus ready가 아니다.

Loop 089는 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-089/`.

## 루프 090 — legacy 번역 batch → source-locked intake 연속성 (LOC-011, 2026-08-09)

현재 canonical translation artifact에는 loop-052에서 생성된 4-locale machine draft가 이미
있었지만, 새 `translation-intake`가 기대하는 `meme` source shape와 loop-052의 `source` shape가
달라 같은 완전 batch를 다시 검수 desk로 넘길 수 없었다. 또한 linked Postgres timestamp의 `+00`
표기를 JavaScript `Date.parse`가 거부했다. 이번 루프는 기존 문구를 새로 발명하지 않고 handoff
계약만 닫았다.

**구현**:

- intake row가 canonical `meme` 또는 legacy `source`를 읽도록 했다.
- legacy `snapshot_hash`/`source_snapshot_hash`가 현재 source snapshot과 정확히 일치하는지 검증한다.
- pack provenance의 `gpt-5.6-luna` 같은 model metadata를 `provider=openai`와 함께 보존하고,
  row-level metadata가 있으면 그것을 우선한다.
- Postgres의 `+00` offset 표기를 허용하되 원문 timestamp 문자열은 변경하지 않아 source-lock SQL의
  hash와 DB cast 경계를 보존한다.
- 생성 artifact header를 사람 번역으로 오인하지 않도록 `reviewable translation pack`으로
  명시했다. 결과 SQL은 기존 `machine`·source revision·idempotent insert·human review gate를
  그대로 사용한다.

**검증**:

- `pnpm translation:intake:test`: legacy source shape/provenance/hash 회귀 포함 통과.
- 실제 `artifacts/renewal/loop-052/global-translation-batch/batch.json`: **8/8 valid rows**,
  **2 memes × 4 locales**, missing locale 0, error 0.
- 임시 artifact emit: `en/ja/zh/zh-tw` 4 SQL, **8 rows**; batch checker `ok=true`.
- canonical `artifacts/renewal/loop-050`을 함께 읽으면 같은 8행을 모두 duplicate로 차단하여
  공급량을 부풀리지 않는다.
- `pnpm translate:memes:mlx-linked:test`, `node scripts/translation-batch-check.test.mjs` 통과.
- 전체 `pnpm test`: **152 files / 998 tests passed**.
- `pnpm exec tsc --noEmit`: 통과; `pnpm lint`: **0 errors / 기존 warning 7개**.
- `pnpm build`: Next.js 16.2.10 webpack **73/73 static pages** 생성.
- 기존 canonical `pnpm translation:check`: **448/1,520**; en=122, ja=142, zh=90, zh-tw=94,
  missing=1,072.

**운영 경계**:

이번 루프는 production DB write, Supabase SQL 실행, human reviewed 승인, 공개 sitemap/hreflang
변경, Plus UI 변경, 외부 게시, push/merge/deploy를 수행하지 않았다. loop-052의 기존 draft는
`gpt-5.6-luna` provenance를 숨기지 않으며, 사용자가 요청한 `gpt-5.6-sol high` 관리자 검수
contract는 별도 server-only review surface에서 유지된다. 새 문구를 `gpt-5.6-sol` 결과로
오인해 공개하지 않았다.

현재 글로벌 공개 공급은 **448/1,520**이고, 다음 실제 공급 루프는 새 canonical meme 하나에 대한
`gpt-5.6-sol high` 4-locale draft 생성 또는 사람이 제공한 pack이 필요하다. Plus의 다음 고레버리지
후보는 기존 boolean completion을 채널·locale·artifact·성과 메모로 확장하는 private Outcome
Ledger이며, authenticated/RLS/RPC 검증을 별도 수직으로 수행한다.

Loop 090은 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-090/`.

## 루프 091 — Plus private Outcome Ledger 연속성 (PLUS-025, 2026-08-09)

Loop 087~090까지 Plus 사용 흐름은 오늘의 카드와 Creator Pack을 준비하고 완료 표시까지
보여줬지만, 실제로 어디에 어떤 언어·산출물로 사용했는지 다음 주에 다시 볼 수 없었다. 이번
루프는 기존 KST completion 원장을 호환용으로 유지하면서, 명시적 활용 완료 뒤에만 private
receipt를 붙이는 수직을 닫았다.

**구현**:

- `plus_meme_use_receipts`를 기존 `plus_meme_use_completions`와 1:1 복합 FK로 연결했다.
  `(user_id, meme_id, completion_date)` unique key와 단일 `record_plus_meme_use_receipt` RPC가
  completion·receipt를 원자적으로 기록하고 재시도에 멱등 응답한다.
- receipt는 channel·exact locale·artifact kind와 선택적 게시 URL·성과 메모·개인 메모를
  저장하며, 제목·source revision snapshot도 보존한다. URL은 서버에서 조회하지 않고 SNS
  자동 게시도 하지 않는다.
- non-ko는 `reviewed`·current source revision·reviewed actor가 모두 맞는 translation만
  허용하고, machine·stale·missing locale은 거절한다. owner + active Plus 정책을 table/RPC
  경계에 두고 기존 직접 completion 함수의 authenticated execute를 회수했다.
- Action Inbox의 완료 버튼은 inline receipt form을 먼저 열고 최종 저장 때만 API를 호출한다.
  Creator Pack은 준비·공유·다운로드만으로 기록하지 않으며, 여러 항목은 순차 저장하고 실패한
  항목과 입력값을 retry 상태로 남긴다.
- private 7일 summary는 KST 범위·channel·locale·artifact·receipt/performance 대기 수만
  보여주며 URL·개인 메모를 노출하지 않는다. `ko`·`en`·`ja`·`zh`·`zh-tw` copy와 Traditional
  Chinese 전용 block을 추가했다.

**검증**:

- focused: **6 files / 51 tests passed** — migration/RPC contract·API entitlement/field gate·
  summary loader·Action Inbox explicit receipt/partial retry·5 locale copy.
- 전체 `pnpm test`: **155 files / 1,032 tests passed**.
- `pnpm exec tsc --noEmit`: 통과.
- `pnpm lint`: **0 errors / 기존 warning 7개**.
- `pnpm build`: Next.js 16.2.10 webpack **73/73 static pages** 통과; metadataBase 기존 warning만 남음.
- local UI/API behavior: Testing Library에서 저장 전 POST 0회, 저장 시 exact locale/channel/artifact/
  optional fields 전달, 실패 입력 유지를 관찰했다. production build server의 signed-out pricing 200와
  `/premium`·`/my`·admin login redirect 경계도 확인했다.
- `git diff --check`: 통과.

**운영 경계**:

이번 루프는 migration/RPC를 파일로만 추가했고 production Supabase 적용·JWT/RLS authenticated
E2E·실제 Plus receipt 저장·human review/publication·외부 게시·push/merge/deploy는 수행하지 않았다.
현재 글로벌 공개 번역 공급은 **448/1,520**이며, 새 receipt는 운영 DB 적용과 authenticated
fixture가 있어야 실제 사용자 데이터로 검증할 수 있다.

Loop 091은 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-091/`.

## 루프 092 — machine-only 번역 artifact gate hardening (LOC-007, 2026-08-09)

Loop 050의 canonical checker는 448/1,520행과 중복·locale·worklist를 확인했지만,
`meme_translations`를 `reviewed`로 승격하는 UPDATE를 오류로 보지 않았다. 이번 루프는
새 번역을 생성하기 전에 이 공개 전이 footgun을 닫았다.

**구현**:

- `translation-batch-check.mjs`가 실행 가능한 SQL statement를 주사해 `meme_translations`
  대상 UPDATE·DELETE·MERGE와 CALL/RPC 형태를 fail-closed로 분류한다.
- legacy INSERT의 `status`, `reviewed_at`, `reviewed_by`를 column/value로 확인해
  machine 초안이 아니거나 reviewed 승격을 시도하면 통과시키지 않는다.
- atomic source-locked INSERT는 `status='machine'`, conflict guard, source snapshot guard를
  확인하는 회귀 경계를 유지한다.
- 기존 448행 artifact는 수정·삭제하지 않고 위험 파일 목록과 실패 사유를 Loop 092 JSON
  증적으로 남겼다. 관리자 GPT 경로는 기존대로 `gpt-5.6-sol` + high + strict JSON +
  `store=false` no-write preview를 사용한다.

**검증**:

- checker regression: UPDATE rejection·reviewed INSERT rejection·clean 1 meme × 4 locale
  complete machine fixture **통과**.
- `pnpm translation:intake:test`, `pnpm translate:memes:mlx-linked:test` **통과**.
- historical `loop-050`: **ok=false 의도적 결과**, forbidden mutation **18건**, rows
  **448/1,520**; en=122, ja=142, zh=90, zh-tw=94.

**운영 경계**:

이번 루프는 OpenAI API 호출·Supabase SQL 실행·production DB write·human review/publication·
sitemap/hreflang·Plus ready 전환·push/merge/deploy를 수행하지 않았다. historical unsafe SQL은
운영자가 검수·정리하기 전까지 적용 대상이 아니며, 새 `gpt-5.6-sol high` 4-locale 공급은
다음 별도 운영 루프에서 이 gate를 통과하는 source-only pack으로 진행한다.

Loop 092는 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-092/`.

## 루프 093 — Plus Outcome Follow-up (PLUS-026, 2026-08-09)

Loop 091은 Action Inbox·Creator Pack에서 명시적으로 활용을 완료한 뒤 private receipt를 남기고
최근 7일 집계를 보여줬지만, 성과 메모를 비워 둔 사용자는 나중에 다시 채울 경로가 없었다. 이번
루프는 새 대시보드를 만들지 않고 기존 Outcome Ledger 안에서 활용 결과를 보충하는 마지막
재방문 루프를 닫았다.

**구현**:

- active Plus의 owner-scoped `plus_meme_use_receipts`를 최근 7일 KST 범위에서 최대 30행 읽은 뒤,
  성과 미입력 우선·최신 날짜 순으로 최대 5건만 UI DTO로 노출한다. 제목·날짜·채널·언어·산출물과
  성과 메모만 사용하며 `result_url`·`private_note`는 client로 보내지 않는다.
- `record_plus_meme_use_performance(receipt_id, performance_note)` security-definer RPC는
  세션 사용자·active Plus·본인 영수증·빈 성과 메모를 다시 확인한 뒤 한 번만 `performance_note`를
  채운다. 기존 값은 덮어쓰지 않고 직접 table update 권한은 열지 않는다.
- 기존 7일 Outcome Ledger 내부에 `최근 활용을 회고하기` 목록과 `성과 추가` 인라인 form을 연결했다.
  저장 성공 시 대기 수와 목록이 새로고침 없이 줄고, 실패 시 입력값이 유지된다. ko/en/ja/zh/zh-tw
  카피와 exact channel/locale/artifact 라벨을 제공한다.
- 글로벌 번역 공개 게이트와 기존 receipt 생성 경계는 변경하지 않았다. 자동 게시·URL fetch·AI 호출·
  Supabase 적용·human review/publication은 수행하지 않았다.

**검증**:

- focused: **7 files / 25 tests passed** — follow-up parser/sort cap·owner loader·RPC migration
  contract·API auth/input/immutable update·5-locale UI interaction.
- 전체 `pnpm test`: **160 files / 1,045 tests passed**.
- `pnpm exec tsc --noEmit`: 통과.
- `pnpm lint`: **0 errors / 기존 warning 7개**; 새 코드 경고 없음.
- `pnpm build`: Next.js 16.2.10 webpack **73/73 static pages** 및 새 performance API route 생성.
- local production HTTP: signed-out `/premium` **307** → `/login?next=%2Fpremium`,
  signed-out `POST /api/plus/outcome-ledger/performance` **401 `{error:"signed_out"}`**.
- `git diff --check`: 통과.

**운영 경계**:

이번 루프는 migration 파일·RPC contract·로컬 UI/API만 추가했고 production Supabase migration 실행,
JWT/RLS authenticated E2E, 실제 Plus receipt/performance 저장, 외부 게시, push/merge/deploy는 수행하지
않았다. 글로벌 공개 번역 공급은 **448/1,520** 그대로이며 historical unsafe artifact 18건도 수정·적용하지
않았다. Loop 093은 로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-093/`.

## 루프 094 — 관리자 GPT 검수 모델 계약 fail-closed (LOC-012, 2026-08-09)

관리자 번역 검수 화면은 이미 `gpt-5.6-sol`과 `reasoning.effort=high`를 사용하고 있었지만,
일반 번역 검수 경로에는 계약 drift를 호출 전에 차단하는 방어가 없었다. 이번 루프는 사용자 요청인
관리자 검수 모델을 모든 server-only 검수 경로에서 같은 계약으로 유지하고, 계약이 어긋나면 GPT·감사
로그·저장을 실행하지 않도록 한 수직만 닫았다.

**구현**:

- `reviewMemeTranslationWithGpt`가 `gpt-5.6-sol` + `high` 계약을 확인한 뒤에만 Responses 요청을 시작한다.
- `lib/openai-review.server.ts`의 실제 요청은 기존처럼 `model=gpt-5.6-sol`,
  `reasoning={effort:"high"}`, `store=false`, strict JSON schema를 사용하며 오래된
  `OPENAI_REVIEW_MODEL` 환경변수는 무시한다.
- 누락 번역 preview도 동일 계약과 source-only/no-write/human publication gate를 유지한다.
- drift 회귀를 추가해 계약 불일치 시 `requestOpenAiStructured`, `admin_audit_log`, 공개 저장이
  호출되지 않음을 확인한다.

**검증**:

- focused: **4 files / 31 tests passed** — Responses payload, 일반 검수 drift fail-closed,
  누락 preview, 관리자 UI.
- 전체 `pnpm test`: **160 files / 1,046 tests passed**.
- `pnpm exec tsc --noEmit`, `pnpm lint` (**0 errors / 기존 warning 7개**), `pnpm build`
  (Next.js 16.2.10 webpack, **73/73 static pages**), `git diff --check` 통과.
- local production HTTP: signed-out `/admin/translations` **307 →
  `/login?next=%2Fadmin%2Ftranslations`**, `/en/pricing` **200**, 성과 API **401
  `{"error":"signed_out"}`**.

**운영 경계**:

이번 루프는 OpenAI API 호출·실제 operator session·Supabase write·machine→reviewed 승인·공개 발행·
sitemap/Plus ready 전환·production deploy/push/merge를 수행하지 않았다. 글로벌 번역 공개 공급은
**448/1,520** 그대로이며, Loop 094는 로컬 `code_complete`이고 public production release로 선언하지
않는다. 증적: `artifacts/renewal/loop-094/`.

## 루프 095 — canonical translation intake preflight (LOC-013, 2026-08-09)

Loop 094까지의 intake는 입력 pack과 지정한 artifact directory의 key 중복은 차단했지만,
서로 다른 historical directory를 canonical 공급 manifest처럼 합치지 못했고 unsafe SQL이
섞인 directory의 행을 현재 공급량으로 오인할 여지가 있었다.

**구현**:

- `scripts/translation-intake.mjs`에 반복 가능한 `--existing-artifact-dir`와 read-only
  merged preflight를 추가했다.
- 기존 SQL row를 conflict guard·machine status·review promotion·forbidden mutation과
  파일별 parse error 기준으로 `existingSafeRows` / `existingUnsafeRows`로 분리한다.
- 입력 pack은 `newRows`, 기존/입력 중복, source snapshot mismatch, worklist 이탈로
  분류하고 `missingBefore`·`missingAfter`·locale별 coverage delta를 계산한다.
- historical directory의 오류는 격리 집계로 남겨 clean 별도 output의 machine-only artifact
  emit을 막지 않는다. output directory 자체의 unsafe row와 parse error는 fail-closed 한다.

**검증**:

- intake/checker/MLX safeguard와 Node syntax check 통과.
- `pnpm test`: 160 files / 1,046 tests 통과.
- `pnpm exec tsc --noEmit`, `pnpm lint` (0 errors / 기존 warning 7개), `pnpm build`,
  `git diff --check` 통과.
- 실제 Loop 052 pack 대 Loop 050 preflight는 8행 모두 기존 key 중복으로 차단했고,
  Loop 050은 448행 중 safe 168·unsafe 280·historical 오류 18건으로 집계했다.

**운영 경계**:

이번 루프는 historical SQL 수정·삭제·적용, 번역 생성, OpenAI 호출, Supabase write,
human review/publication, push/merge/deploy를 수행하지 않았다. 공개 공급은 **448/1,520**
그대로이며 `pnpm translation:check`의 18개 historical mutation 오류도 의도적으로 남겨
fail-closed 상태를 유지한다. 증적: `artifacts/renewal/loop-095/`.

## 루프 096 — Plus Next Move 성과 학습 루프 (PLUS-027, 2026-08-09)

Loop 093의 Outcome Follow-up은 성과 메모를 나중에 보충할 수 있었지만, 그 결과가 다음 추천에
반영되지 않았다. 이번 루프는 Plus의 기존 `발견 → Creator Pack → 활용 완료 → 회고` 흐름을
구조화된 1회 평가와 다음 추천으로 닫았다.

**구현**:

- `plus_meme_use_receipts.performance_rating` additive migration과
  `record_plus_meme_use_rating(receipt_id, performance_rating)` security-definer RPC를
  추가했다. 세션 사용자·active Plus·본인 receipt·빈 값·`hit|neutral|miss` enum을 서버에서
  확인하고, 이미 평가된 receipt는 덮어쓰지 않는다. 직접 table update 권한은 열지 않는다.
- 최근 28일 KST·최대 50건의 rating만 owner-scoped로 읽고, candidate별 `hit=+1`,
  `neutral=0`, `miss=-1`로 정렬한다. 같은 점수는 기존 Action Inbox 순서를 유지하고,
  오늘 완료한 밈은 후보에서 제외한다. 3건 미만은 `learning` 상태로 표시한다.
- 기존 7일 Outcome Follow-up에 `좋았어요/보통이에요/아쉬웠어요` 평가를 추가했다. 저장 성공 시
  부모 Action Inbox의 local seed를 갱신해 같은 화면의 `PLUS NEXT MOVE`가 즉시 다시 정렬된다.
- Next Move는 공개 title·summary·href와 평가 신호만 렌더링하며 `performance_note`,
  `private_note`, `result_url`는 recommendation DTO/UI에 포함하지 않는다. ko/en/ja/zh와
  zh-tw fallback copy를 제공한다.
- 신규 rating column이 아직 적용되지 않은 rolling deploy에서는 기존 note follow-up을 legacy
  select로 유지하고 rating lane만 unavailable로 격리한다. 글로벌 번역 reviewed/current 공개
  gate와 관리자 `gpt-5.6-sol` + high 검수 계약은 변경하지 않았다.

**검증**:

- focused: **7 files / 28 tests passed** — deterministic ranking/date window, 5-locale Next Move
  surface, rating API auth/one-time contract, migration guard, rating UI.
- 전체 `pnpm test`: **164 files / 1,060 tests passed**.
- `pnpm exec tsc --noEmit`: 통과.
- `pnpm lint`: **0 errors / 기존 warning 7개**; 새 코드 오류·warning 없음.
- `pnpm build`: Next.js 16.2.10 webpack, TypeScript 완료, **73/73 static pages**, 신규
  `/api/plus/outcome-ledger/rating` route 생성. sandbox DNS 실패 후 read-only network
  escalation으로 재시도해 통과했으며, `metadataBase` 경고는 기존 경고다.
- local production HTTP: signed-out `/premium` **307** → `/login?next=%2Fpremium`,
  `/admin/translations` **307** → `/login?next=%2Fadmin%2Ftranslations`, `/en/pricing`
  **200**, signed-out `POST /api/plus/outcome-ledger/rating` **401**.
- `git diff --check`: 통과.

**운영 경계**:

이번 루프는 migration 파일·RPC/API contract·local UI/loader만 추가했다. production Supabase
적용, authenticated JWT/RLS E2E, 실제 Plus receipt/rating 저장, OpenAI 호출, human review/
publication, 외부 게시, push/merge/deploy는 수행하지 않았다. 글로벌 reviewed 번역 공급은
**448/1,520** 그대로이며 historical unsafe artifact도 수정·적용하지 않았다. Loop 096은
로컬 `code_complete`이며 public production release로 선언하지 않는다.
증적: `artifacts/renewal/loop-096/`.

## 루프 097 — 글로벌 locale 검색 발견성 surface (LOC-014, 2026-08-09)

글로벌 locale 상세 페이지는 reviewed/current 번역이 있어도 사용자가 직접 찾을 수 있는 검색
동선이 없었다. 이번 루프는 기존 한국어 `search_memes` RPC를 유지하면서 exact locale 번역이
안전하게 있는 결과만 번역 상세로 연결하고, 나머지는 한국어 원문으로 명시하는 검색 surface를
추가했다.

**구현**:

- `/en/search`, `/ja/search`, `/zh/search`, `/zh-tw/search` route와 loading surface를 추가하고,
  locale별 title/description/input/empty/fallback copy를 제공했다. `zh-tw`는 번체 카피를 별도
  제공하고 나머지 UI locale은 기존 fallback 규칙을 따른다.
- `getLocalizedSearchMemes`가 `meme_translations -> memes!inner` 단일 batch read를 사용하고,
  `reviewed`, source revision current, 필수 번역 필드, 원문 content-depth, public moderation
  gate를 모두 통과한 행만 `short_id` Map으로 반환한다.
- 검수된 번역은 `localizedMemePath`로, 미번역·stale·machine·incomplete·depth 부족·조회 실패는
  `/memes/...` 한국어 canonical로 연결한다. fallback 카드에는 locale별 원문 라벨과 `lang="ko"`를
  붙여 언어 신호를 숨기지 않는다.
- global header, localized search form, mobile search link가 `/en|ja|zh|zh-tw/search`를 사용하고,
  언어 전환 시 `?q=`를 보존한다. 인기 검색 칩은 한국어 RPC로 재검색 가능한 한국어 원문을
  유지한다.
- 검색 route는 `noindex, follow`와 locale self-canonical만 제공하며 hreflang·x-default·sitemap
  cluster에는 추가하지 않는다.

**검증**:

- focused: **4 files / 41 tests passed** — localized search metadata, `/search` route localization,
  query-preserving locale switching, translation public gate.
- 전체 `pnpm test` (**165 files / 1,063 tests**), `pnpm exec tsc --noEmit`, `pnpm lint` (0 errors / 기존 warning 7개),
  `pnpm build` (Next.js 16.2.10 webpack, **77/77 static pages**, `/[locale]/search` route),
  `git diff --check` 통과.
- local production HTTP: `/en/search`, `/ja/search?q=원문`, `/zh-tw/search` 모두 **200**; document
  language, noindex/follow, locale canonical, locale form action, localized/fallback card href와
  `lang="ko"`를 실제 HTML에서 확인했다.

**운영 경계**:

이번 루프는 검색 route·copy·public read helper·회귀 테스트만 추가했다. 번역 생성·OpenAI 호출,
machine→reviewed 승인, production Supabase write, sitemap 공개, 자동 게시, production deploy,
push/merge는 수행하지 않았다. 글로벌 reviewed 번역 공급은 **448/1,520** 그대로이며, Loop 097은
로컬 `code_complete`로만 기록한다. 증적: `artifacts/renewal/loop-097/`.

## 루프 098 — Plus Outcome Snapshot 첫 화면 가치 증명 (PLUS-028, 2026-08-09)

Plus는 Action Inbox·Creator Pack·활용 영수증·성과 후속·Next Move까지 이어졌지만, 최근 활용 결과가
Action Inbox 내부의 접힌 요약에 묻혀 첫 방문에서 구독 효과가 보이지 않았다. 이번 루프는 기존
owner-scoped read model을 재사용해 `추천 → 사용 → 결과 확인 → 다음 행동`을 `/premium` 첫 화면에서
바로 보이게 하는 수직만 닫았다.

**구현**:

- `PlusOutcomeSnapshot`을 active Plus 대시보드 헤더 직후, Action Inbox보다 먼저 렌더링했다. 오늘 활용 수·
  연속 일수, 최근 7일 활용 수, 성과 입력 대기 수, 최근 평가 수를 서버 집계값으로만 표시한다.
- 최근 7일 채널·언어·산출물 breakdown에서 가장 많이 사용한 항목만 표시하며, 효과가 좋았다고 추정하지
  않고 “가장 많이 사용한 흐름”으로만 표현한다.
- `ready`, `empty`, `unavailable`을 분리하고, 빈 상태에서는 Action Inbox anchor만 제공하며, 조회 실패는
  숫자 0으로 변환하지 않는다. receipt ID·meme ID·URL·성과 메모·개인 메모는 client/UI로 전달하지 않는다.
- `ko`·`en`·`ja`·`zh`·`zh-tw` copy와 UI-only locale의 영어 fallback을 제공했다. 기존 Action Inbox와
  7일 상세 요약은 유지하되 상세 요약은 기본 펼침으로 전환했다.

**검증**:

- focused: **3 files / 13 tests passed** — ready/empty/unavailable, 개인정보 비노출, 5 locale fallback,
  Action Inbox보다 앞선 렌더 순서.
- 전체 `pnpm test`: **166 files / 1,066 tests passed**.
- `pnpm exec tsc --noEmit`: 통과.
- `pnpm lint`: **0 errors / 기존 warning 7개**.
- `pnpm build`: Next.js 16.2.10 webpack, **77/77 static pages**.
- `git diff --check`: 통과.
- 최종 local production HTTP: `/premium` **307** → `/login?next=%2Fpremium`; 인증 경계가 유지된다.

**운영 경계**:

이번 루프는 기존 owner-scoped read model·로컬 UI·회귀 테스트만 변경했다. production Supabase migration/write,
authenticated Plus/RLS E2E, 실제 receipt/rating 저장, 번역 생성·human publication, OpenAI 호출, 외부 게시,
production deploy/push/merge는 수행하지 않았다. 글로벌 reviewed 번역 공급은 **448/1,520** 그대로이며,
증적은 `artifacts/renewal/loop-098/`에 남겼다.

## 루프 099 — 글로벌 번역 누락 작업 진입 링크 (LOC-015, 2026-08-09)

번역 coverage 표는 로케일별 `검토 필요`와 `원문 변경` 수를 작업 큐로 연결했지만, `누락` 수는 숫자만
표시해 운영자가 언어를 다시 선택하고 누락 원문 preview까지 찾아가야 했다. 이번 루프는 새 큐나
번역 데이터를 만들지 않고 기존 locale 필터·누락 목록·사람 검수 흐름을 직접 연결하는 한 가지
운영 vertical만 닫았다.

**구현**:

- `TranslationCoveragePanel`의 양수 `누락` 수를 `/admin/translations?locale=<locale>` 링크로 바꿨다.
- 링크는 기존 `listMissingMemeTranslations`와 `MissingTranslationDraftPreview`를 그대로 재사용하며,
  누락 원문은 기존 최신순 최대 20건 범위와 명시적 GPT preview/save/review 게이트를 유지한다.
- accessible name은 언어명·누락 수·작업 의도를 포함하고, 0건 로케일은 링크 없이 숫자만 렌더링한다.
- 기존 machine/stale review links, Plus 요청 claim, public reviewed/current gate는 변경하지 않았다.

**검증**:

- focused **1 file / 2 tests passed** — 양수 로케일 링크·accessible name·기존 큐 링크 공존·0건 비링크.
- 전체 `pnpm test`: **166 files / 1,066 tests passed**.
- `pnpm exec tsc --noEmit`: 통과.
- `pnpm lint`: **0 errors / 기존 warning 7개**.
- `pnpm build`: Next.js 16.2.10 webpack, **77/77 static pages**.
- local production HTTP: `/admin/translations?locale=en` **307** → `/login?locale=en&next=%2Fadmin%2Ftranslations`.

**운영 경계**:

이번 루프는 관리자 탐색 UI와 회귀 테스트만 변경했다. source-readiness 계산, Plus completion trigger,
번역 생성·OpenAI 호출, machine→reviewed 승인, production Supabase write/migration, publication,
authenticated operator QA, deploy/push/merge는 수행하지 않았다. 글로벌 reviewed 번역 공급은 **448/1,520**
그대로이며, 증적은 `artifacts/renewal/loop-099/`에 남겼다.

## 루프 100 — Plus 오늘의 1컷과 source-incomplete 공개 게이트 (PLUS-029, 2026-08-09)

Plus 첫 화면은 활용 결과 숫자·Action Inbox·7일 요약이 함께 보여서 사용자가 오늘 무엇을 해야 하는지
바로 결정하기 어려웠고, Creator Pack을 만들어도 실제 카드 이미지를 확인하기 전까지 결과를 볼 수 없었다.
이번 루프는 여러 기능을 더하는 대신 검수된 밈 하나를 `추천 → 카드 준비 → 미리보기 → 공유/다운로드 →
명시적 활용 기록 → 다음 카드`로 끝내는 첫 화면 vertical만 닫았다.

**구현**:

- active Plus `/premium`의 Action Inbox를 `one_cut` 모드로 렌더해 첫 번째 eligible action 하나만 노출하고,
  기존 aggregate snapshot은 action 뒤로 이동했다. 기존 full inbox 모드는 기본값으로 유지했다.
- 기존 localized export를 재사용해 카드 PNG를 준비하고, one-cut에서는 생성된 blob을 실제 `<img>` 미리보기와
  캡션/상세 링크 텍스트로 보여준다. Web Share·clipboard·download fallback은 기존 경계를 유지한다.
- 활용 완료 전 자동 completion은 하지 않는다. one-cut receipt는 채널·산출물만 빠르게 확인하고 URL·성과·개인
  메모는 기존 full receipt에서만 받는다. 저장 성공 뒤 현재 카드를 제거해 다음 카드를 이어서 선택한다.
- 완료된 번역도 원문 content-depth가 `isIndexableMeme`를 통과하지 못하면 `source_incomplete`로 표시하고
  localized detail/action link를 만들지 않는다. 서버 select에 공개 게이트에 필요한 depth 신호를 포함했다.

**검증**:

- focused one-cut UI: **1 file / 12 tests passed**; translation fulfillment/global action/dashboard 회귀도 통과.
- 전체 `pnpm test`: **166 files / 1,072 tests passed**.
- `pnpm exec tsc --noEmit`: 통과.
- `pnpm lint`: **0 errors / 8 warnings** — 기존 7개와 blob preview `<img>` 최적화 경고 1개.
- `pnpm build`: 네트워크 허용 재검증, Next.js 16.2.10 webpack, **77/77 static pages**. 샌드박스 최초 시도는
  sitemap Supabase DNS 차단으로 실패했으나 코드 컴파일은 성공했고, 같은 빌드를 권한 허용 환경에서 통과시켰다.
- local production HTTP: `/premium` **307** → `/login?next=%2Fpremium`; CSP의 `blob:` 이미지 경계도 확인했다.

**운영 경계**:

이번 루프는 기존 owner-scoped read model·localized export·completion API와 로컬 UI/회귀 테스트만 변경했다.
production Supabase write/migration, authenticated Plus/RLS E2E, 실제 receipt 저장, 번역 생성·GPT 호출,
human publication, external post, deploy, push, merge는 수행하지 않았다. 글로벌 reviewed 번역 공급은
**448/1,520** 그대로이며, 증적은 `artifacts/renewal/loop-100/`에 남겼다.

## 루프 101 — Reviewed Localized Explore v1과 Scout 공개 게이트 정렬 (LOC-016, 2026-08-09)

기존 글로벌 홈과 검색은 있었지만 locale별 공개 탐색 선반이 없었고, Plus Global Scout는 원문 필수 텍스트만
확인해 실제 localized detail의 content-depth 게이트와 다른 카드를 만들 수 있었다. 이번 루프는 필터·검색·
무한 스크롤을 추가하지 않고, 색인 가능한 기본 discovery deck 하나와 공개 판정 일치만 닫았다.

**구현**:

- `app/[locale]/explore/page.tsx`와 localized copy/card를 추가해 `en`·`ja`·`zh`·`zh-tw`에 서버 렌더링
  탐색 허브를 만들었다. exact locale `reviewed`·source current·필수 번역 필드·`isIndexableMeme`를 모두
  통과한 상위 카드만 표시하며 한국어 fallback은 만들지 않는다.
- locale별 적격 카드가 24개 이상일 때만 `active`·indexable로 보고, 미달 `coverage-empty`와 DB 오류
  `unavailable`을 별도 상태로 렌더한다. query variant는 self-canonical·`noindex,follow`다.
- localized static path allowlist와 desktop/mobile 탐색 링크를 locale route에 연결했다. sitemap은 24개
  이상 적격 locale만 reciprocal explore entry/hreflang에 넣고, robots는 계속 허용한다.
- Plus Global Scout select에 원문 depth 신호를 추가하고 `isIndexableMeme`를 적용해 Scout 카드가 public
  localized detail의 공개 정의를 우회하지 않게 했다. 기존 5개 제한·안전/유행·Plus entitlement·locale
  계약은 유지했다.

**검증**:

- focused locale/sitemap/routing **3 files / 30 tests**, Scout **2 files / 17 tests** 통과.
- 전체 `pnpm test`: **167 files / 1,077 tests passed**.
- `pnpm exec tsc --noEmit`: 통과.
- `pnpm lint`: **0 errors / 8 warnings**.
- `pnpm build`: Next.js 16.2.10 webpack, TypeScript 포함, **81/81 static pages** 생성.
- local production HTTP: 네 locale explore **200**, `<html lang>`·localized metadata·self canonical 확인;
  `/en/explore` 카드 href **24개**, query variant `noindex,follow`; `/en` locale nav·한국어 `/explore`
  기존 nav·sitemap locale `<loc>` 각 1개·robots sitemap 허용을 확인했다.
- 상세 증적: `artifacts/renewal/loop-101/acceptance.md`, `artifacts/renewal/loop-101/verification.md`.

**운영 경계**:

이번 루프는 읽기 전용 public/Plus projection과 route/UI만 변경했다. production translation write/publication,
Supabase migration/RLS apply, OpenAI call, authenticated Plus QA, deploy/push/merge는 수행하지 않았다.

## 루프 102 — Locale-safe Plus Weekly Brief과 localized trend anchor (LOC-017, 2026-08-09)

Plus Weekly Change Brief가 글로벌 UI에서도 원문 한국어 `title`·`summary`·`slug`를 사용하고, 번역
reviewed/current·원문 depth/publication 게이트를 적용하지 않아 구독자의 locale 신뢰를 깨뜨릴 수 있었다.
또한 localized detail에는 주간 CTA가 가리키는 `#trend-panel-title`이 없었다. 이번 루프는 주간 브리프
하나의 수직만 닫고, 실제 번역 생성·공개는 운영 게이트로 유지했다.

**구현**:

- `buildPlusWeeklyBriefCandidates`를 추가해 `ko`는 기존 canonical source를 유지하고, `en`·`ja`·`zh`·
  `zh-tw`는 exact reviewed/current·필수 4필드·localized slug·`approved|limited`·`isIndexableMeme`
  source만 사용한다. missing/stale/machine/incomplete/shallow/private 후보는 Korean fallback 없이 제외하고
  아래 적격 후보로 채운다.
- Premium page는 resolved content locale을 기준으로 원문 depth/source/translation을 읽고, free branch에는
  weekly candidate·translation·metric read가 발생하지 않도록 했다. 기존 KST 7일 positive delta·green·
  rising/active·surfaced exclusion·최대 3개 순서는 유지한다.
- `unavailable`·`coverage_empty`·`no_candidates`·`insufficient_history`·`no_change`를 구분하고, 한국어를 포함한
  source query 오류는 빈 결과로 위장하지 않는다. UI-only locale은
  English content route를 사용한다. `zh-tw` weekly copy를 별도 번체 블록으로 추가했다.
- localized detail에 `MemeTrendPanel`을 연결해 weekly CTA의 `#trend-panel-title` anchor를 실제로 제공한다.

**검증**:

- 독립 code review가 발견한 source-error/no-change 상태 오류를 수정하고 regression을 추가했다.
- focused weekly/copy/detail **4 files / 106 tests passed**
- 전체 `pnpm test`: **167 files / 1,087 tests passed**
- `pnpm exec tsc --noEmit`: 통과
- targeted ESLint: 오류 없음
- `pnpm build`: Next.js 16.2.10 webpack, **81/81 static pages**
- fresh local production HTTP: `/premium` **307** login redirect, `/en/memes/7jwfbdck-baby-shark-pinkfong` **200**,
  `lang="en"`·`trend-panel-title` 확인, `/en/explore`에서 실제 localized detail href 확인

**운영 경계**:

이번 루프는 read-only Plus projection·locale copy·localized detail UI와 회귀 테스트만 변경했다. production
Supabase write/migration/RLS, authenticated Plus populated QA, translation generation/publication, OpenAI call,
payment, deploy, push, merge는 수행하지 않았다. 글로벌 reviewed 번역 공급은 **448/1,520** 그대로다.

## 루프 103 — Plus One-Cut Value Proof (PLUS-030, 2026-08-09)

Plus의 기능 표면은 이미 충분했지만 pricing과 active dashboard의 약속이 trend radar 중심으로 남아 있어,
구독 직후 사용자가 체감할 “검수된 밈 선택 → 게시용 카드 준비 → 실제 사용 기록” 결과가 흐려져 있었다.
이번 루프는 새 독립 기능을 추가하지 않고 기존 one-cut Action Inbox와 Outcome Snapshot을 핵심 value proof로
정렬했다.

**구현**:

- 한국어·영어·일본어·중국어 간체·번체 pricing/active/upgrade copy를 결과 중심으로 교체했다. `$20`, 30일
  이용권, 자동 갱신 없음과 무료 사전 기능은 유지했다.
- pricing와 active dashboard checkout form이 locale을 전달하고, checkout API는 exact 지원 locale만
  localized pricing `next` 경로로 보존한다. UI-only locale·잘못된 값·빈 body는 `/pricing`으로 안전하게
  수렴한다.
- pricing view, checkout start/return, one-cut ready/prepared, receipt saved 퍼널 이벤트를 추가했다.
  one-cut 이벤트는 locale·count·bounded channel/artifact·idempotency flag만 전송하고 private note·result URL·
  meme ID·title·source URL을 전송하지 않는다.
- 신규 migration·RPC·DB write·OpenAI 호출·결제 entitlement 판정은 추가하지 않았다.

**검증**:

- focused checkout/copy/dashboard/one-cut/analytics contract **5 files / 111 tests passed**
- 전체 `pnpm test`: **168 files / 1,095 tests passed**
- `pnpm exec tsc --noEmit`: 통과
- `pnpm lint`: **0 errors / 8 existing warnings**
- `pnpm build`: network 권한 재실행에서 Next.js 16.2.10 webpack **81/81 static pages** 생성
- `git diff --check`: 통과
- fresh local production HTTP: `/en/pricing` **200**와 English result-first title·hidden locale·no-auto-renew,
  `/zh-tw/pricing` **200**와 Traditional Chinese title·hidden locale, `/premium` **307** login redirect 확인
- 상세 증적: `artifacts/renewal/loop-103/acceptance.md`, `artifacts/renewal/loop-103/verification.md`

**운영 경계**:

이번 루프는 local code/test/build/HTTP gate까지만 실행했다. production 결제, authenticated Plus populated QA,
Supabase migration/RLS/RPC 적용, 번역 publication, OpenAI 호출, deploy, push, merge는 수행하지 않았다.

## 루프 104 — Preview One-Cut Activation Proof (ACT-001, 2026-08-09)

Loop 103에서 만든 one-cut 결과 약속이 실제 유료 사용 흐름으로 이어지는지 확인하기 위해, 새 기능 대신
격리 preview activation proof를 선택했다. 병렬 critic은 현재 기능 추가를 **REJECT**했고, 실제 결제·인증·DB/RLS·
배포 증거가 핵심 병목이라고 판정했다. designer의 “추천 밈 → 게시 준비” UI 제안은 D-049의 one-cut 우선 결정과
activation gap 때문에 이번 루프에서는 보류했다.

**확인**:

- worktree는 modified/tracked 85개, untracked 218개로 clean release candidate 분리가 아직 필요하다.
- live read-only HTTP는 `/en/pricing` **404**, `/en/explore` **404**, `/premium` **307**이었다. local Loop 103
  smoke의 `/en/pricing` **200**과 일치하지 않아 public production 완료로 주장할 수 없다.
- 관리자 GPT 계약은 `gpt-5.6-sol`·reasoning `high`·`store=false`로 이미 고정되어 있다. 실제 OpenAI 호출은 하지 않았다.
- reviewed 글로벌 번역은 **448/1,520**으로 변하지 않았고, 이번 루프에서 pack·publication·DB write는 하지 않았다.

**Human Gate**:

preview Supabase, Unifi test payment 자격증명, clean RC SHA, reviewed/current 영어 fixture가 모두 필요하다.
이 중 하나라도 없으면 migration/RLS/JWT·결제·receipt 브라우저 QA를 시작하지 않는다. 상세 증적은
`artifacts/renewal/loop-104/acceptance.md`와 `artifacts/renewal/loop-104/verification.md`에 기록했다.

## 루프 104 종료 상태

`CATCHMEME_HUMAN_DECISION_REQUIRED` — 이번 루프는 production 변경 없이 종료한다.

## 루프 105 — One-Cut Recommendation First (PLUS-031, 2026-08-09)

Loop 104의 activation human gate를 우회해 새 기능을 늘리지 않고, 기존 one-cut의 결과 순서만 고쳤다. 기존
DOM은 `Create Creator Pack` 준비 블록과 준비 결과를 추천 카드보다 먼저 렌더해, 구독자가 무엇을 쓸지 보기 전에
준비 CTA를 만났다.

**구현**:

- `components/premium/plus-global-action-inbox.tsx`에서 `one_cut`에만 `ActionCard` 목록을 Creator Pack 준비 블록 앞으로 이동했다. 기본 `inbox` 모드는 기존 순서를 유지한다.
- one-cut explicit receipt는 ActionCard 밖에서 Creator Pack CTA·준비 결과·preview·상태 메시지 뒤에 렌더된다.
  이제 active one-cut은 `추천 밈 → 카드/캡션 준비 → 준비 결과 → 활용 receipt` 순서를 따른다.
- 추천 정렬, exact locale href, 복사·공유·compact receipt, completion API/RPC, six privacy-safe analytics payload,
  empty/unavailable 상태와 기존 locale copy는 변경하지 않았다.
- `components/premium/plus-global-action-inbox.test.tsx`에 mode-specific 순서·receipt 위치·empty/unavailable 경계 회귀를 추가했다.

**검증**:

- focused **1 file / 14 tests passed**, 전체 `pnpm test` **168 files / 1,097 tests passed**
- `pnpm exec tsc --noEmit` 통과
- `pnpm lint` **0 errors / 8 warnings**
- `pnpm build` **81/81 static pages**
- `git diff --check` 통과
- fresh local production HTTP (`localhost:3115`): `/en/pricing` **200**, `/zh-tw/pricing` **200**, `/en/explore` **200**, signed-out
  `/premium` **307**
- 상세 증적: `artifacts/renewal/loop-105/acceptance.md`, `artifacts/renewal/loop-105/verification.md`

**운영 경계**:

이번 루프는 기존 UI DOM 순서와 테스트만 변경했다. production 결제·Supabase migration/RLS/RPC·번역 publication·
OpenAI 호출·deploy·push·merge는 수행하지 않았다. ACT-001 activation human gate와 reviewed 번역 448/1,520은 그대로다.

## 루프 105 종료 상태

`code_complete` — local presentation vertical만 완료; 독립 코드 리뷰 PASS. public production 반영과 실제 Plus activation은 ACT-001 gate 이후에만 주장한다.

## 루프 106 — Coverage-Empty Original Explore Action (LOC-018, 2026-08-09)

Loop 105 이후의 다음 안전한 vertical로, 글로벌 locale Explore의 번역 coverage-empty 상태에 다음 행동을
추가했다. 번역 fallback이나 publication을 우회하지 않고 한국어 원본 탐색으로만 연결한다.

**구현**:

- `app/[locale]/explore/page.tsx`의 `coverage-empty`에만 `/explore` CTA를 추가했다.
- `en`·`ja`·`zh`·`zh-tw` copy에 locale별 CTA label을 추가했다.
- active 카드, unavailable alert, reviewed/current/depth/no-fallback 공개 게이트는 변경하지 않았다.
- `app/[locale]/explore/page.test.tsx`에서 네 locale CTA와 active/unavailable 부재를 고정했다.

**검증**:

- focused **2 files / 5 tests passed**, 전체 `pnpm test` **169 files / 1,099 tests passed**
- `pnpm exec tsc --noEmit` 통과
- `pnpm lint` **0 errors / 8 warnings**, scoped eslint 통과
- `pnpm build` **81/81 static pages**, `git diff --check` 통과
- fresh local production HTTP (`localhost:3116`): `/en|ja|zh|zh-tw/explore` **200**
- 독립 코드 리뷰 **PASS — APPROVE**
- 상세 증적: `artifacts/renewal/loop-106/acceptance.md`, `artifacts/renewal/loop-106/verification.md`

**운영 경계**:

이번 루프는 locale copy·server-rendered CTA·회귀 테스트만 변경했다. 번역 생성·publication, Supabase
migration/RLS/RPC, OpenAI 호출, production payment, deploy/push/merge는 수행하지 않았다.

## 루프 106 종료 상태

`code_complete` — local global discovery vertical만 완료. 실제 locale coverage 보강과 public production 반영은 별도 운영 gate다.

## 루프 107 — One-Cut Outcome Follow-Up (PLUS-032, 2026-08-09)

Plus 대시보드는 활용 후 `성과 입력 대기` 수치를 보여주지만, 실제 Premium이 사용하는 `one_cut` 모드에서
성과 메모와 hit/neutral/miss 평가 UI를 숨기고 있었다. 이로 인해 추천 → 사용 기록 뒤에 다음 추천을
개선할 입력이 끊기는 dead end가 있었다.

**구현**:

- `components/premium/plus-global-action-inbox.tsx`가 `outcomeFollowUps.status === "ready"`인 one-cut에서만
  기존 `PlusOutcomeFollowUp`을 표시한다.
- 기존 performance/rating API, privacy-safe copy, Next Move rating callback을 재사용한다.
- Creator Pack·receipt 뒤에 follow-up을 배치하고 locked/empty/unavailable·default inbox path는 변경하지 않았다.
- one-cut pending follow-up 노출/순서와 non-ready 부재 회귀 테스트를 추가했다.

**검증**:

- focused **3 files / 22 tests passed**, 전체 `pnpm test` **169 files / 1,101 tests passed**
- `pnpm exec tsc --noEmit` 통과
- `pnpm lint` **0 errors / 8 warnings**, `pnpm build` **81/81 static pages**, `git diff --check` 통과
- fresh local production HTTP (`localhost:3117`): `/en/pricing`·`/zh-tw/pricing`·`/en/explore` **200**, signed-out `/premium` **307**
- 독립 코드 리뷰 **PASS — APPROVE**
- 상세 증적: `artifacts/renewal/loop-107/acceptance.md`, `artifacts/renewal/loop-107/verification.md`

**운영 경계**:

이번 루프는 기존 read model/UI/API를 연결한 local Plus presentation vertical이다. production payment,
Supabase migration/RLS/RPC, 번역 publication, OpenAI 호출, deploy/push/merge는 수행하지 않았다.

## 루프 107 종료 상태

`code_complete` — local subscription outcome loop만 완료. 실제 authenticated Plus/RLS/receipt persistence는 ACT-001 운영 gate 이후에만 주장한다.

## 루프 108 — Plus 수요·번역 공급 우선순위 정렬 (LOC-019, 2026-08-09)

관리자 Plus 번역 큐는 요청 수를 보여주고 있었지만, 사람 번역 intake의 source/worklist/중복/unsafe
gate와 연결되지 않아 “무엇을 먼저 번역하고 검수할지”를 한 번 더 수동으로 조합해야 했다.

**구현**:

- `scripts/translation-demand-report.mjs`를 추가해 기존 `translation:intake --json` report와
  operator-safe aggregated Plus demand export를 읽기 전용으로 결합한다.
- 네 locale(`en`·`ja`·`zh`·`zh-tw`)별 `missingBefore`·`missingAfter`·`missingDelta`와 active
  request/meme/actionable request 수를 함께 출력한다.
- exact source revision과 locale을 기준으로 `missing`·`stale`·`review_needed`·`ready`·`unknown`을
  fail-closed 분류하고, 번역 공급이 막힌 행을 `ready`보다 먼저 결정론적으로 정렬한다.
- 기존 intake의 unsafe artifact·duplicate·source mismatch·worklist gate 결과를 `intake.gates`와
  `intake.errors`로 보존한다. owner ID·private note·번역 본문은 입력에 있어도 report에 복사하지 않는다.
- `scripts/translation-demand-report.test.mjs`와 package scripts를 추가했다. 이 수직은 DB/RPC write,
  SQL/OpenAI 호출, 번역 artifact 생성, human review/publication, public route를 변경하지 않는다.

**검증**:

- `pnpm translation:demand-report:test` 통과
- Loop 095 historical intake preflight + local operator demand fixture로 CLI JSON을 실행해 intake gate가
  `ok=false`로 유지되고, 두 수요 행이 `missing`/`review_needed`로 출력되는 것을 확인했다(exit 1은 의도된
  fail-closed 결과)
- `pnpm test` **169파일 / 1,101건**, `pnpm exec tsc --noEmit`, `pnpm lint` 0 errors/8 warnings,
  `pnpm build` **81/81**, `git diff --check` 통과
- 독립 code review **PASS** — nullable missing revision·sub-gate fail-closed·strict timestamp·deterministic tie-break 보강 후 재검토

**운영 경계**:

이번 루프는 report-only local operator tooling만 추가했다. 실제 Plus demand export·authenticated operator
session·OpenAI `gpt-5.6-sol` high 호출·translation pack 생성/검수/발행·Supabase 적용·production deploy는
수행하지 않았다. 글로벌 reviewed 공급은 **448/1,520** 그대로이며 ACT-001 human gate도 유지한다.

증적: `artifacts/renewal/loop-108/`.

## 루프 108 종료 상태

`code_complete` — 수요·공급 alignment report와 fail-closed regression을 완료했으며, 사용자가 요청한 이번 루프에서 종료한다.

## 루프 109 — One-Cut 평가·Next Move 학습 handoff (PLUS-033, 2026-08-09)

Loop 107에서 one-cut에 성과 메모와 hit/neutral/miss 입력을 연결했지만, 평가가 실제로 다음 추천을
바꿔도 `Next Move`는 full inbox에서만 보여 구독자가 학습 효과를 같은 화면에서 확인할 수 없었다.

**구현**:

- `components/premium/plus-global-action-inbox.tsx`에서 one-cut의 `Next Move`를 기존 평가가 있거나
  현재 세션에서 평가 저장이 성공한 경우에만 렌더한다.
- one-cut에서는 기존 추천·Creator Pack·receipt·outcome follow-up 뒤에 배치해 초기 행동 순서를 보존한다.
- 기존 `outcomeRatings` local state를 그대로 사용해 성공 응답 직후 추천 후보와 signal을 재계산한다.
- full inbox의 기존 무조건 노출, owner-scoped rating API/RLS, privacy-safe DTO와 empty/unavailable 경계를
  변경하지 않았다. 새 DB/API/schema/analytics/private field는 추가하지 않았다.
- 초기 숨김·기존 rating 노출·성공 저장 후 즉시 재계산·실패 저장 후 숨김·full inbox 보존 회귀를 추가했다.

**검증**:

- focused **4 files / 31 tests passed**, 전체 `pnpm test` **169 files / 1,106 tests passed**
- `pnpm exec tsc --noEmit` 통과
- `pnpm lint` **0 errors / 8 warnings**, `git diff --check` 통과
- `pnpm build` **81/81 static pages** 통과. 기존 `metadataBase` 경고는 유지됐다.
- rendered markup와 jsdom rating-save success/failure 흐름을 focused test로 관찰했다.
- 독립 code review **PASS — no remaining findings**

**운영 경계**:

이번 루프는 기존 local Plus UI/state/test만 연결했다. production payment·authenticated Plus/RLS·Supabase
migration/RPC write·번역 publication·OpenAI 호출·deploy/push/merge는 수행하지 않았다. ACT-001 human gate와
글로벌 reviewed 공급 **448/1,520** 상태는 그대로다.

증적: `artifacts/renewal/loop-109/`.

## 루프 109 종료 상태

`code_complete` — one-cut에서 평가 결과가 같은 화면의 Next Move로 이어지는 local 학습 handoff를 완료했다.
사용자가 요청한 이번 루프까지만 실행하고 종료한다.

## 루프 110 — 글로벌 번역 요청·Plus 요청함 handoff (PLUS-034, 2026-08-09)

글로벌 locale 상세에서 Plus 사용자가 번역 검수를 요청할 수 있었지만, 요청이 `requested` 또는 `in_review`가
된 뒤에도 진행 상황을 확인할 수 있는 Plus 요청함으로 바로 이어지지 않았다. 이로 인해 글로벌 구독 가치가
“요청을 눌렀다”에서 멈췄다.

**구현**:

- `components/premium/translation-priority-button.tsx`에 확인된 `requested`·`in_review` 상태만 기존
  `/premium#plus-translation-fulfillment-title`로 연결하는 tracking link를 추가했다.
- 성공한 request 응답 직후 같은 화면에서 요청 상태와 tracking link를 보여준다.
- 2xx 응답에 상태가 없거나 허용되지 않은 값이면 `requested`로 추정하지 않고 `unavailable` + retry copy로
  fail-closed 처리한다.
- 상태 표시를 순수 renderer로 분리해 SSR에서 confirmed positive와 `none`·`completed`·`dismissed`·
  `already_available`·`unavailable` no-link 경계를 직접 고정했다.
- `ko`·`en`·`ja`·`zh`·`zh-tw` copy/fallback, free pricing, signed-out save-required, 기존 request RPC/RLS와
  privacy 경계를 유지했다. 새 route·DB/API/schema/migration/publication은 추가하지 않았다.

**검증**:

- focused **4 files / 121 tests passed**, 전체 `pnpm test` **169 files / 1,119 tests passed**
- `pnpm exec tsc --noEmit` 통과
- `pnpm lint` **0 errors / 8 warnings**, `git diff --check` 통과
- `pnpm build` **81/81 static pages** 통과. 기존 `metadataBase` 경고는 유지됐다.
- static markup와 jsdom의 requested/in_review·성공 요청·malformed response·free/signed-out 흐름을 관찰했다.
- 독립 code review **PASS — no remaining findings**

**운영 경계**:

이번 루프는 기존 global detail·Plus request desk·RPC를 연결하는 local UI/test vertical이다. production payment,
authenticated Plus/RLS, Supabase write, human translation review/publication, OpenAI 호출, deploy/push/merge는
수행하지 않았다. 글로벌 reviewed 공급 **448/1,520**과 ACT-001 human gate는 그대로다.

증적: `artifacts/renewal/loop-110/`.

## 루프 110 종료 상태

`code_complete` — 글로벌 Plus 번역 요청이 확인된 상태에서 기존 요청함으로 이어지는 local handoff를 완료했다.

## 루프 111 — 글로벌 상세에서 Plus Use Kit으로 이어지는 활용 handoff (PLUS-035, 2026-08-09)

글로벌 localized detail은 Save·번역 요청·Export까지 제공했지만, 구독자가 밈을 실제로 써 보려면
페이지 아래의 Use Kit을 다시 찾아야 했다. 공개 discovery에서 구독자의 즉시 활용 결과로 이어지는
짧은 handoff를 기존 surface 안에서 닫았다.

**구현**:

- 상세 action row 바로 아래에 기존 `#meme-use-kit-title`로 이동하는 locale-safe `Open the Use Kit`
  CTA를 추가했다.
- CTA는 entitlement를 중복 조회하지 않고 기존 Use Kit을 진입점으로 사용한다. free/signed-out은
  기존 locked panel과 `/pricing` 게이트를 그대로 만나며 Plus 권한을 추정하지 않는다.
- active Plus Use Kit에 기존 copy-all 흐름을 보존한 native share와 clipboard fallback을 추가했다.
- copy/share 성공 뒤 session-only `prepared` status를 표시하고, native share 취소와 clipboard 실패는
  완료로 오인하지 않는다.
- Use Kit은 상세에 이미 표시된 reviewed/current localized facts만 사용한다. 새 AI·DB·API·RPC·
  persistence·private payload는 추가하지 않았다.
- `ko`·`en`·`ja`·`zh`와 기존 `zh-tw → zh` fallback copy, Save·번역 요청·Export·canonical·
  safety/lifecycle 경계를 보존했다.
- focused regression에 entry/locked boundary·copy/share success/failure·AbortError cancel·
  prepared reload reset·detail wiring을 추가했다.

**검증**:

- leader focused **3 files / 98 tests passed**; independent reviewer rerun **4 files / 100 tests passed**
- 전체 `pnpm test` **169 files / 1,124 tests passed**
- `pnpm exec tsc --noEmit` 통과
- `pnpm lint` **0 errors / 8 warnings**, `git diff --check` 통과
- `pnpm build` **exit 0 / 81/81 static pages** 통과
- local production Chromium에서 `/en/memes/ra86attn` 200·정상 title·CTA fragment 이동·signed-out
  locked panel·`/pricing` gate를 확인했고, 독립 reviewer는 375×812 overflow/page error 없음도 확인했다.
- 독립 code review **PASS / APPROVE — issues 0**

**운영 경계**:

이번 루프는 기존 global detail·Plus Use Kit·clipboard/share surface를 연결하는 local UI/test
vertical이다. authenticated Plus/RLS, production payment, Supabase write, human translation
review/publication, OpenAI 호출, deploy/push/merge는 수행하지 않았다. 글로벌 reviewed 공급
**448/1,520**과 ACT-001 human gate는 그대로다.

증적: `artifacts/renewal/loop-111/`.

## 루프 111 종료 상태

`code_complete` — 글로벌 상세에서 기존 Plus Use Kit으로 실제 활용을 시작하는 local handoff를
완료했다. 사용자가 요청한 이번 루프까지만 실행하고 종료한다.

## 루프 112 — Global Daily 완료에서 Use Kit으로 이어지는 handoff (PLUS-036, 2026-08-09)

Global Meme Daily는 글로벌 reviewed/current 밈을 3문제로 익히게 하지만, 완료 뒤에는 score와
streak만 보여 주고 실제 활용 행동으로 이어지지 않았다. 이번 루프는 완료 결과를 기존 localized
detail → Use Kit → outcome 흐름의 첫 단계로 연결했다.

**구현**:
- 성공적인 local completion과 서버의 already-completed re-entry에서 score/streak 아래에
  locale-safe `Use this meme now` next-step CTA를 렌더한다.
- CTA는 deterministic하게 선택된 첫 challenge meme의 기존 localized detail route와
  `#meme-use-kit-title` fragment를 직접 가리킨다.
- CTA는 Global Daily가 이미 검수한 title·short ID·localized slug만 사용하며, 새 추천 목록이나
  private payload를 만들지 않는다.
- signed-out·locked·unavailable branch, completion POST body/response, streak 계산, 기존 analytics
  event, 5개 locale copy와 route/canonical 경계를 유지했다.
- 새 DB/API/RPC/schema/persistence/analytics event/OpenAI/payment surface는 추가하지 않았다.
- 즉시 완료·completed re-entry·5개 locale gate·unavailable·정확한 English/Japanese href 회귀를
  추가했다.

**검증**:
- leader focused **4 files / 102 tests passed**; independent reviewer focused **6 files / 39 tests passed**
  및 component scenarios **8/8**
- 전체 `pnpm test` **169 files / 1,125 tests passed**
- `pnpm exec tsc --noEmit` 통과
- `pnpm lint` **0 errors / 8 warnings**, `git diff --check` 통과
- `pnpm build` 네트워크 권한 재실행 **exit 0 / 81/81 static pages**
- local Chromium `/en/daily` signed-out gate와 `/en/memes/ra86attn` detail Use Kit fragment 이동을 확인했다.
- 독립 code review **PASS / APPROVE — issues 0**

**운영 경계**:
이번 루프는 기존 Global Daily·localized detail·Use Kit을 연결하는 local UI/test vertical이다.
authenticated Plus/RLS, production completion write, 결제, human translation review/publication,
OpenAI 호출, deploy/push/merge는 수행하지 않았다. 글로벌 reviewed 공급 **448/1,520**과 ACT-001
human gate는 그대로다.

증적: `artifacts/renewal/loop-112/`.

## 루프 112 종료 상태

`code_complete` — Global Daily 완료가 기존 Use Kit 활용 흐름으로 이어지는 local handoff를 완료했다.

## 루프 113 — checkout confirmation에서 첫 One-Cut으로 이어지는 handoff (PLUS-037, 2026-08-09)

결제 복귀 상태 배너는 웹훅 기반 entitlement 확인과 화면 새로고침까지만 제공해, 활성 구독자가
확인 직후 첫 Plus 행동을 다시 찾아야 했다. 이번 루프는 새 데이터 surface 없이 기존 Action Inbox의
첫 One-Cut anchor로 짧은 handoff를 닫았다.

**구현**:

- `?checkout=return`에서 서버 entitlement가 `isPremium: true`로 확인된 경우에만 결제 확인 문구와
  `Start your first One-Cut` CTA를 표시한다.
- CTA는 기존 `/premium#plus-global-action-inbox-title`을 직접 가리키며 자동 이동하지 않는다.
- entitlement 확인 전·polling rejection/HTTP 오류·timeout·일반 `/premium`·signed-out에는 CTA가 없다.
- 기존 3초 × 20회 polling, `router.refresh()`, 결제 provider/privacy 경계와 5개 locale copy를
  유지했다. 루프 103부터 존재한 `plus_checkout_returned` 계측은 변경하지 않았다.
- 새 DB/API/RPC/schema/persistence/payment 상태 판정/analytics event/OpenAI surface는 추가하지
  않았다.

**검증**:

- focused **2 files / 98 tests passed**
- 전체 `pnpm test` **170 files / 1,135 tests passed**
- `pnpm exec tsc --noEmit` 통과
- `pnpm lint` **0 errors / 8 warnings**, `git diff --check` 통과
- `pnpm build` **exit 0 / 81/81 static pages**
- local Chromium signed-out `/premium?checkout=return` → `/login?checkout=return&next=%2Fpremium`,
  Plus CTA 미노출
- 독립 code review **PASS / APPROVE — findings 0**

**운영 경계**:

이번 루프는 기존 checkout return·entitlement polling·Plus Action Inbox를 연결하는 local UI/test
vertical이다. 실제 결제·웹훅·authenticated Plus/RLS·Supabase write·human translation review/
publication·OpenAI live call·deploy/push/merge는 수행하지 않았다. 글로벌 reviewed 공급
**448/1,520**과 ACT-001 human gate는 그대로다.

증적: `artifacts/renewal/loop-113/`.

## 루프 113 종료 상태

`code_complete` — 서버 entitlement 확인 뒤 기존 Plus Global Action Inbox의 첫 One-Cut으로 이어지는
local checkout handoff를 완료했다. 전체 목표는 production activation·번역 publication·데이터 품질
human gate가 남아 있어 완료 선언하지 않는다.

## 루프 114 — localized search coverage-empty 복구 (LOC-020, 2026-08-09)

글로벌 locale 검색에 한국어 결과는 있지만 해당 언어의 reviewed/current 공개 번역이 하나도 없을 때,
결과 카드만 한국어 원문으로 남아 사용자가 다음 탐색 행동을 선택하기 어려웠다. 원문을 번역 결과처럼
보여 주지 않고, 명시적으로 한국어 Explore catalog로 복구하는 수직을 추가했다.

**구현**:

- `getLocalizedSearchMemesResult`가 exact reviewed/current/depth-qualified 결과를 `active`,
  `coverage-empty`, `unavailable`로 구분하고, 기존 Map 반환 함수 호환 경계를 유지한다.
- 검색 결과에 대해서만 localized result 수를 계산한다. query 결과가 있고 localized result가
  0건이며 lookup이 `coverage-empty`일 때만 locale copy 기반 Korean original CTA를 렌더한다.
- CTA target은 정확히 `/explore`다. active localized result·unavailable lookup·zero-result에서는
  CTA가 없다. 기존 Korean original label·원문 link, query search, reviewed/current/depth,
  canonical·robots·hreflang·analytics 경계는 변경하지 않았다.
- 새 DB/API/RPC/schema/persistence/translation content/OpenAI/production write/deploy는 추가하지
  않았다. 글로벌 reviewed 공급 **448/1,520**과 LOC-007/LOC-010 운영 gate는 유지한다.

**검증**:

- focused **4 files / 48 tests passed** (`search page`, render regression, translation lookup,
  routing)
- 전체 `pnpm test` **171 files / 1,154 tests passed**
- `pnpm exec tsc --noEmit` 통과; `pnpm lint` 0 errors / 8 warnings; `git diff --check` 통과
- `pnpm build` 네트워크 권한 재실행 **exit 0 / 81/81 static pages**. 첫 sandbox DNS 실패는
  verification artifact에 기록했다.
- local Chromium에서 `/en/search?q=좋다` coverage-empty CTA → 정확한 `/explore` 이동과
  `/en/search?q=밈` active localized result·no-CTA를 확인했다. 네 locale copy와
  unavailable/zero-result no-CTA는 render regression으로 확인했다.
- 독립 code review follow-up **PASS — remaining findings 0**. 초기 테스트 커버리지 지적은 네 locale
  음성 상태 행렬과 mocked-client lookup 분류 회귀로 보강했다.

**운영 경계**:

이번 루프는 local presentation-only search recovery다. 번역 생성·사람 검수·publication,
authenticated Plus/RLS, 결제, Supabase migration/RPC 적용, OpenAI live call, production
deploy/push/merge는 수행하지 않았다.

증적: `artifacts/renewal/loop-114/acceptance.md`, `artifacts/renewal/loop-114/verification.md`

## 루프 114 종료 상태

`code_complete` — 글로벌 검색 coverage-empty에서 한국어 원문 Explore로 복구하는 local handoff를
완료했다. 전체 목표는 production activation·번역 publication·데이터 품질 human gate가 남아 있어
완료 선언하지 않는다.

## 루프 115 — localized search에서 번역 옵션으로 이어지는 handoff (LOC-021, 2026-08-09)

루프 114는 글로벌 검색의 번역 coverage-empty를 한국어 Explore로 복구했지만, 사용자가 원하는
언어의 번역 수요를 기존 Plus 번역 요청 표면까지 다시 찾아가야 했다. 이번 루프는 검색 의도가
가장 강한 순간에 기존 한국어 상세의 번역 옵션으로 이어지는 선택형 handoff를 닫았다.

**구현**:

- `GLOBAL_SEARCH_COPY`에 `ko`·`en`·`ja`·`zh`·`zh-tw`의 `translationOptions` copy를 추가했다.
- query 결과가 있고 localized lookup이 성공한 `coverage-empty`일 때만 기존 Korean original
  Explore CTA 옆에 번역 옵션 CTA를 표시한다.
- CTA는 첫 검색 결과의 기존 `memePathFrom(short_id, slug)` canonical 한국어 상세에
  `#global-translation-title`을 붙인다. 가짜 localized route나 번역 완료 주장을 만들지 않는다.
- 목적지의 기존 `TranslationPriorityButton`·save-required·free pricing·signed-out·Plus·
  request-status gate, 기존 검색 query/metadata/analytics/submit 및 Korean original fallback은
  변경하지 않았다.
- 새 DB/API/RPC/schema/persistence/translation content/OpenAI/payment/analytics event/production
  write/deploy는 추가하지 않았다. 글로벌 reviewed 공급 **448/1,520**과 LOC-007/LOC-010 운영 gate는
  유지한다.

**검증**:

- focused **5 files / 63 tests passed**; 전체 `pnpm test` **171 files / 1,154 tests passed**
- `pnpm exec tsc --noEmit` 통과; `pnpm lint` 0 errors / 8 warnings; `git diff --check` 통과
- `pnpm build` exit 0, static pages **81/81**. 새 CTA의 hover class가 A11Y source guard와
  충돌한 첫 full test 1건은 `hover:brightness-110`으로 수정 후 재검증했다.
- local Chromium `/en/search?q=좋다`에서 Explore·translation options 두 CTA와 exact
  `/memes/...#global-translation-title`을 확인하고, 실제 한국어 상세 글로벌 번역 section과
  signed-out pricing gate에 도착했다. `/en/search?q=밈` active localized result 및 zero-result는
  두 CTA가 없었다.
- 독립 code review **PASS — concrete findings 0**. architect 2-lane merge-readiness는 leaf-reviewer
  제한으로 unavailable이며 코드 결함은 아니다.

**운영 경계**:

이번 루프는 기존 한국어 상세·번역 요청 surface를 연결하는 local presentation-only handoff다.
실제 Plus 인증·RLS/RPC, 사람 번역 검수/publication, 결제, OpenAI live call, Supabase write,
production deploy/push/merge는 수행하지 않았다.

증적: `artifacts/renewal/loop-115/acceptance.md`, `artifacts/renewal/loop-115/verification.md`

## 루프 115 종료 상태

`code_complete` — 글로벌 검색 coverage-empty에서 기존 한국어 상세 번역 옵션으로 이어지는 local
handoff를 완료했다. 전체 목표는 production activation·번역 publication·데이터 품질 human gate가
남아 있어 완료 선언하지 않는다.

## 루프 116 — empty Action Inbox에서 saved Next Move로 이어지는 Plus handoff (PLUS-038, 2026-08-09)

오늘 Action Inbox 후보를 모두 완료하면 Plus 화면이 `empty`가 되어, 이미 저장한 current/green
밈을 다시 활용할 명시적 다음 행동이 사라졌다. 이번 루프는 기존 Saved Reuse Radar의 owner-scoped
`readyNow` 후보를 기존 Plus Next Move에 연결해 구독자가 다음 활용으로 끊기지 않게 했다.

**구현**:

- Action Inbox가 `empty`이고 completion read가 `available`일 때만 `radar.readyNow`를 Next Move
  입력으로 사용한다. active/unavailable inbox는 기존 후보와 상태를 그대로 유지한다.
- Saved Reuse Radar가 이미 적용한 green + rising/active gate와 completion의 completed IDs를
  재사용한다. completed candidate는 다시 추천하지 않는다.
- `ko`는 canonical detail, `en`·`ja`·`zh`·`zh-tw`는 exact reviewed/current/required-field/
  content-depth를 통과한 localized detail만 사용한다. UI-only locale은 기존
  `resolvePlusContentLocale`에 따라 English content로 정규화한다.
- savedAt·collection·private note는 client DTO에 넣지 않고, 모든 locale의 Use Kit anchor와
  saved signal copy를 회귀로 고정했다.
- 새 DB/API/RPC/schema/migration/write/analytics/OpenAI/payment surface는 추가하지 않았다.

**검증**:

- leader focused **6 files / 39 tests passed**; 전체 `pnpm test` **171 files / 1,158 tests passed**
- `pnpm exec tsc --noEmit` 통과; `pnpm lint` 0 errors / 8 warnings; `git diff --check` 통과
- `pnpm build` 네트워크 권한 재실행 **exit 0 / 81/81 static pages**
- local Chromium signed-out `/premium` → `/login?next=%2Fpremium` redirect와 로그인 화면을 확인했다.
  authenticated Plus/RLS fixture가 없어 populated empty-inbox fallback branch는 실행하지 않았다.
- 초기 독립 review의 3개 medium finding(콘텐츠 locale 정규화, savedAt 비노출, 5 locale regression)을
  수정하고 fresh code-reviewer **PASS — concrete findings 0**을 확인했다.

**운영 경계**:

이번 루프는 기존 Saved Reuse Radar·Plus Next Move·Meme Use Kit을 연결하는 local presentation-only
vertical이다. authenticated Plus/RLS/JWT, receipt write, 결제, 사람 번역 검수/publication, OpenAI
live call, Supabase migration, production deploy/push/merge는 수행하지 않았다. 글로벌 reviewed
공급 **448/1,520**과 ACT-001·DQ critical gate는 그대로다.

증적: `artifacts/renewal/loop-116/acceptance.md`, `artifacts/renewal/loop-116/verification.md`

## 루프 116 종료 상태

`code_complete` — empty Action Inbox가 저장한 current/green 밈의 locale-safe Next Move로 이어지는
local Plus handoff를 완료했다. 전체 목표는 production activation·번역 publication·데이터 품질
human gate가 남아 있어 완료 선언하지 않는다.

## 루프 117 — channel-ready One-Cut Creator Pack (PLUS-039, 2026-08-09)

기존 Creator Pack은 범용 card만 준비하고 실제 게시 채널을 receipt에서 다시 물어, Plus 구독자가
준비 결과를 바로 게시하기까지 한 단계가 남아 있었다. 이번 루프는 기존 reviewed/current
콘텐츠·export route·receipt를 재사용해 게시 채널 선택을 준비 단계로 앞당겼다.

**구현**:

- Creator Pack 생성 전에 접근 가능한 9개 게시 채널 선택을 요구하고, 미선택이면 export GET을
  호출하지 않는다.
- `instagram`·`tiktok`·`youtube`는 `story`, 나머지는 `card` format으로 결정론적으로 매핑한다.
  기존 locale/detail/safety/entitlement export gate와 `creator_pack` artifact kind를 유지한다.
- One-Cut의 generic `Mark used` 우회 경로를 숨기고, 성공적인 Creator Pack 준비 뒤에만 명시적
  receipt action을 연다. 선택 채널은 receipt에 미리 채우되 실제 사용자가 수정할 수 있다.
- share 취소·일부 export 실패·clipboard 실패는 prepared/downloaded 상태로 남고 receipt POST를
  자동 호출하지 않는다. 4:5 crop을 제거하고 story/card intrinsic ratio를 보존한다.
- `ko`·`en`·`ja`·`zh`·`zh-tw` copy를 제공하며, `zh-tw` Creator Pack은 번체 전용 override로
  분리했다. 신규 analytics event·DB/API/RPC/schema/migration/OpenAI surface는 추가하지 않았다.

**검증**:

- focused **3 files / 127 tests passed**
- 전체 `pnpm test` **171 files / 1,171 tests passed**
- `pnpm exec tsc --noEmit` 통과
- `pnpm lint` **0 errors / 8 warnings**, `git diff --check` 통과
- `pnpm build` **exit 0 / 81/81 static pages**. 기존 metadataBase warning 유지
- local Chromium signed-out `/premium` → `/login?next=%2Fpremium`, 375×812 boundary와 로그인
  화면을 확인했다. authenticated Plus fixture가 없어 populated Creator Pack browser receipt는
  실행하지 않았다.
- fresh independent `gpt-5.6-sol` high review **PASS — 0 findings**. review 대상 현재
  uncommitted snapshot의 HEAD는 `901b7f93b11945ff66471989fcc3ae985553fa97`다.

**운영 경계**:

이번 루프는 기존 Plus Creator Pack·localized export·outcome receipt를 연결하는 local vertical이다.
실제 payment/entitlement·RLS/JWT·receipt production write·human translation publication·Supabase
migration·production deploy/push/merge는 수행하지 않았다. historical translation intake
448/1,520은 이번 루프의 live supply 증명이 아니며, ACT-001·DQ critical gate와 RC/worktree
consistency gate는 계속 열린다.

증적: `artifacts/renewal/loop-117/acceptance.md`, `artifacts/renewal/loop-117/verification.md`

## 루프 117 종료 상태

`code_complete` — 게시 채널 선택에서 story/card Creator Pack 준비, explicit `creator_pack` receipt,
실패 fail-closed와 local verification을 완료했다. 전체 목표는 production activation·번역
publication·데이터 품질 human gate가 남아 있어 완료 선언하지 않는다.

## 루프 118 — outcome-based posting channel recommendation (PLUS-040, 2026-08-09)

Loop 117에서 게시 채널을 선택하게 했지만, 모든 Plus 사용자에게 같은 초기값을 주고 최근
성과를 다음 준비에 반영하지 않았다. 이번 루프는 기존 `plus_meme_use_receipts`의
`channel`·`performance_rating`을 재사용해, 최근 28일 owner-scoped 성과가 충분하고 양수일 때만
Creator Pack 기본 채널을 추천한다.

**구현**:

- rating query가 기존 receipt read에 `channel`을 포함하고, invalid/missing channel은
  projection 단계에서 버린다. 새 쓰기·스키마·API는 추가하지 않았다.
- 순수 추천기는 전체 rating 3건 이상, 채널별 2건 이상을 요구하고 hit +1 / neutral 0 /
  miss -1 점수와 hit-rate·sample·최근 완료일·고정 채널 순서로 tie를 해결한다. 양수 승자만
  노출하며 `ratingsStatus=unavailable`에서는 추천하지 않는다.
- Creator Pack은 추천을 초기값으로만 사용한다. 사용자가 수동으로 채널을 바꾸면 늦게 도착한
  rating 응답이 선택을 덮지 않으며, 추천 문구는 ko/en/ja/zh/zh-tw에 제공한다.

**검증**:

- focused **4 files / 47 tests passed**
- 전체 `pnpm test` **172 files / 1,182 tests passed**
- `pnpm exec tsc --noEmit` 통과
- `pnpm lint` **0 errors / 8 existing warnings**
- `pnpm build` **exit 0 / 81/81 static pages**; 기존 metadataBase warning 유지
- local Chromium에서 signed-out `/premium` → `/login?next=%2Fpremium`와 `/zh-tw/pricing`
  번체 화면 렌더를 확인했다. authenticated Plus populated receipt branch는 fixture 부재로
  실행하지 않았다.
- fresh `gpt-5.6-sol` high verifier **PASS**. `git diff --check`도 문서 갱신 후 통과했다.

**운영 경계**:

이번 루프는 기존 Plus receipt/read·Creator Pack UI를 연결하는 local vertical이다. 실제
authenticated Plus/RLS/payment/receipt 저장, Supabase 적용, production activation,
translation publication, deploy/push/merge는 수행하지 않았다. 관리자 GPT 검수의
`gpt-5.6-sol` + high reasoning 계약은 이미 존재하며 human review/publication gate를 유지한다.
historical translation supply 448/1,520과 1,072행 잔여, 데이터 품질 critical gate, RC/worktree
consistency gate도 계속 열린다.

증적: `artifacts/renewal/loop-118/acceptance.md`, `artifacts/renewal/loop-118/verification.md`

## 루프 118 종료 상태

`code_complete` — 성과 기반 Creator Pack 채널 추천과 fail-closed/manual 선택 보호,
local verification을 완료했다. 사용자가 요청한 대로 이번 루프에서 중단하며 전체 글로벌
서비스·콘텐츠 공급·Plus 운영 목표의 완료를 선언하지 않는다.

## 루프 119 — reviewed usage-example powered Scenario One-Cut (PLUS-041, 2026-08-09)

Loop 118은 최근 성과가 좋은 게시 채널을 추천했지만, Creator Pack의 실제 문구는 여전히
제목·요약·안전 안내에 머물렀다. 이번 루프는 이미 관리자 검수 경계를 통과한
usage_examples[{ situation, text }]를 사용자가 상황별로 고르고, 선택한 한 줄을
One-Cut 공유 문구에 포함한다.

**구현**:

- lib/usage-examples.ts를 단일 런타임 parser로 두고 최대 3개, 비어 있지 않은
  situation·text만 통과시켰다. 기존 상세 UsageExamples와 Plus 흐름이 같은 parser를
  재사용한다.
- Global Scout의 한국어 canonical row와 외국어의 정확히 현재 시점과 일치하는
  reviewed translation row에서만 예문을 전달한다. 외국어는 한국어 예문으로 fallback하지
  않는다. Translation Fulfillment와 Daily Signal도 같은 경계를 따른다.
- One-Cut Creator Pack에 상황 selector와 검수 예문 preview를 추가했다. 선택한 예문은
  기존 localized caption·safety·detail link와 함께 share text에 들어가며, 새 문장을
  생성하거나 DB/API/RPC/analytics/OpenAI 호출을 추가하지 않는다.
- 예문이 없는 경우 “검수된 예문이 없어 새 문장을 만들지 않는다”는 상태를 노출하고
  기존 generic Creator Pack만 준비한다. 사용자가 명시적으로 Creator Pack을 만들고
  실제로 사용 완료를 기록하는 receipt gate는 그대로 둔다.

**검증**:

- focused 8 files / 176 tests passed — exact locale/current example, parser, pack share
  text, Action Inbox propagation, One-Cut situation selection flow
- 전체 pnpm test -- --reporter=dot 172 files / 1,188 tests passed
- pnpm exec tsc --noEmit 통과
- pnpm lint 0 errors / 8 existing warnings
- pnpm build exit 0 / 81/81 static pages
- One-Cut UI render test에서 상황 선택 → 채널 선택 → export mock → preview의 선택 예문
  노출을 확인했다. authenticated Plus/live reviewed 공급은 fixture 부재로 미실행했다.
- fresh gpt-5.6-sol high code reviewer PASS

**운영 경계**:

이번 루프는 reviewed usage example의 local read/DTO/UI/share-text 연결만 완료했다. 실제
authenticated Plus/RLS/payment/receipt 저장, human translation pack publication, Supabase
migration, production deploy/push/merge는 수행하지 않았다. 관리자 GPT 보조 검수의
gpt-5.6-sol + high reasoning strict contract와 human approval/publication gate는
그대로 유지한다. historical reviewed translation 448/1,520과 1,072행 잔여는 이번 루프의
live supply 증명이 아니다.

증적: artifacts/renewal/loop-119/acceptance.md, artifacts/renewal/loop-119/verification.md

## 루프 119 종료 상태

code_complete — reviewed/current usage example을 상황 기반 One-Cut Creator Pack의
실제 공유 문구로 연결하고, 예문이 없을 때 생성하지 않는 fail-closed·5 locale UI·전체
회귀 검증을 완료했다. 사용자가 요청한 대로 이번 루프에서 종료하며 전체 글로벌 서비스·
콘텐츠 공급·Plus 운영 목표의 완료를 선언하지 않는다.

## 루프 120 — opt-in multi-card Scenario Creator Pack (PLUS-042, 2026-08-09)

Loop 119는 첫 One-Cut 밈의 검수 예문을 고르게 했지만, `/premium` 후보가 여러 개일 때
추가 밈을 함께 준비하거나 밈별 문구를 선택할 수 없었다. 이번 루프는 첫 행동을 분산시키지
않으면서, 사용자가 명시적으로 opt-in한 경우에만 다중 Creator Pack을 밈별 Scenario로
준비하게 했다.

**구현**:

- `/premium`의 `mode="one_cut"` 기본 동작은 첫 밈 한 장과 기존 상황 selector를 유지한다.
- 후보가 2개 이상일 때만 `include more` checkbox가 나타나며, 선택하면 추가 카드와 각 카드의
  reviewed usage example selector/preview가 열린다.
- `buildPlusCreatorPack`은 단일 index 대신 `memeId → usageExampleIndex` map을 받아 각 share
  text에 해당 밈의 선택 문구만 포함한다. 첫 밈의 선택이 다른 밈에 전파되지 않는다.
- 예문이 없는 item은 명시적 no-example copy를 표시하고 새 문장을 생성하지 않는다. 기존
  reviewed/current/exact-locale/no-fallback, export channel, explicit receipt와 owner/privacy
  경계를 바꾸지 않았다.
- 새 DB/API/RPC/schema/migration/write/analytics/OpenAI/publication automation은 추가하지 않았다.

**검증**:

- focused **8 files / 179 tests passed** — item별 selector, opt-in, share text isolation,
  no-example, existing locale/current propagation
- 전체 `pnpm test -- --reporter=dot` **172 files / 1,191 tests passed**
- `pnpm exec tsc --noEmit` 통과; `pnpm lint` 0 errors / 8 existing warnings
- `pnpm build` exit 0; compiled and TypeScript/static generation completed for **81 pages** with
  network-authorized sitemap lookup; existing `metadataBase` warning remains
- `git diff --check` 통과
- local component UI flow에서 One-Cut 1개 유지 → include-more opt-in → 두 밈 selector →
  channel 선택 → 두 카드 export mock → item별 clipboard share text를 확인했다.
- fresh independent `gpt-5.6-sol` high code review **PASS — 0 findings**

**운영 경계**:

이번 루프는 기존 Plus read DTO·export와 local client selection을 확장한 수직이다. 실제
authenticated Plus/RLS/payment/receipt 저장, live reviewed translation supply, human publication,
Supabase migration, production deploy/push/merge는 수행하지 않았다. `448/1,520` historical
translation artifact는 live 공급 증거가 아니며 ACT-001·DQ critical·RC consistency gate는 계속 열린다.

증적: `artifacts/renewal/loop-120/acceptance.md`, `artifacts/renewal/loop-120/verification.md`

## 루프 120 종료 상태

`code_complete` — One-Cut 기본값과 explicit multi-card opt-in, memeId별 reviewed Scenario
선택·share text isolation·no-example fail-closed와 회귀 검증을 완료했다. 전체 글로벌 서비스·
콘텐츠 공급·Plus 운영 목표의 완료를 선언하지 않는다.

## 루프 121 — route-ready translation worklist (LOC-022, 2026-08-09)

현재 글로벌 병목은 번역 행의 개수가 아니라, 운영자가 번역 한 건으로 실제 locale route와 Plus
공급을 열 수 있는 원문을 먼저 찾을 수 있는지였다. 기존 `/admin/translations`의 누락 목록은
원문 최신순만 사용했고, Plus 수요 RPC 실패는 빈 큐와 구분되지 않았다.

**구현**:

- 기존 `isIndexableMeme()`와 `content-depth` 신호를 재사용해 공개 원문이 번역 후 글로벌 route를
  열 수 있는 `routeUnlockCandidate`인지 순수 함수로 판정한다.
- 관리자 누락 번역 목록은 공개 원문 전체를 읽기 전용으로 스캔한 뒤 route-unlock 후보 우선,
  `updatedAt` 내림차순, `memeId` 오름차순으로 결정론적으로 정렬하고 요청 limit만 반환한다.
- `focusMemeId`가 있으면 해당 누락 원문을 limit 안에 첫 행으로 예약해, 일반 후보가 많아도
  Plus 요청의 claim 이후 검수 액션이 화면에서 사라지지 않게 한다.
- 원문 보강이 필요한 항목은 별도 상태로 표시한다. 이는 번역 reviewed·route 200·publication을
  의미하지 않으며, 기존 GPT preview/save/review human gate를 그대로 사용한다.
- Plus 번역 수요 RPC 실패는 `unavailable` alert로 표시하고 “대기 요청 없음”으로 축소하지 않는다.
- 새 DB/API/RPC/schema/migration/write/자동 번역/자동 publication/analytics는 추가하지 않았다.

**검증**:

- focused **4 files / 30 tests passed** — source depth classification, full-scan deterministic
  ordering, focused Plus row reservation, admin list integration, route-unlock badges, Plus queue
  unavailable/empty separation
- 전체 `pnpm test -- --reporter=dot` **173 files / 1,196 tests passed**
- `pnpm exec tsc --noEmit` 통과; `pnpm lint` 0 errors / 8 existing warnings
- `pnpm run build` exit 0; Next.js static generation **81/81** pages; existing `metadataBase`
  warning remains
- `git diff --check` 통과
- `pnpm translation:check`는 기존 공급 상태인 **448/1,520**, missing 1,072, forbidden mutation
  18건으로 실패했다. 이는 이번 루프에서 번역을 생성·발행하지 않은 증거이며 live 공급 완료가 아니다.
- fresh `gpt-5.6-sol` high code review에서 확인된 focused-row limit 결함을 수정하고 re-review PASS를 확인했다. 실제 operator session, authenticated Plus/RLS,
  production translation publication과 route smoke 정상 데이터는 미실행이다.

**운영 경계**:

이번 루프는 관리자 read/worklist와 fail-closed UI만 변경했다. GPT 보조 검수는 기존
`gpt-5.6-sol` + `high`, `store: false`, strict schema 및 운영자 최종 승인 계약을 유지한다.
결제·entitlement·receipt·Supabase migration/RLS·번역 SQL 적용·production deploy/push/merge는
수행하지 않았다. 현재 `pnpm smoke`의 `/rankings` 오류와 SEO-001 soft-404, ACT-001·DQ critical·
RC consistency gate는 계속 열린다.

증적: `artifacts/renewal/loop-121/acceptance.md`, `artifacts/renewal/loop-121/verification.md`

## 루프 121 종료 상태

`code_complete` — route-unlock 후보를 운영자에게 먼저 제공하고, 큐 장애를 빈 결과로 오인하지
않는 local route/worklist contract를 완료했다. 글로벌 번역 공급·Plus 운영·production readiness의
완료는 선언하지 않는다.

## 루프 122 — ACT-001-lite local activation evidence (2026-08-09)

Loop 117~121은 Plus 결과 준비와 관리자 번역 큐의 로컬 계약을 넓혔지만, 실제 Supabase JWT/RLS와
receipt 원장을 통과한 증거가 없었다. 이번 루프는 새 Plus UI를 추가하지 않고, 기존 글로벌 콘텐츠와
구독 결과가 실제 로컬 데이터 경로에서 이어지는지 확인했다.

**구현**:

- `scripts/plus-activation-local.mjs`를 추가하고 `pnpm run plus:activation:local` 명령으로 연결했다.
- 스크립트는 `LOCAL_SUPABASE_URL`이 `127.0.0.1:54321` 또는 `localhost:54321`일 때만 실행하며,
  local anon/service-role key를 명시적으로 요구한다. production URL/key는 허용하지 않는다.
- 최신 12개 Plus migration은 `supabase db push --local`로 로컬 DB에만 적용했고, 기존 seed DB를
  reset하지 않았다. 임시 Auth 계정 3개와 reviewed-current 영어 fixture 1개를 만들고 종료 시
  translation·subscription·profile·receipt가 cascade cleanup되도록 했다.
- active Plus는 reviewed/current 영어 밈 receipt를 생성하고 같은 요청 재시도는 동일 receipt로
  멱등 처리한다. free/canceled Plus는 `plus_required`로 차단되고, 다른 active Plus 사용자는
  타인의 receipt를 읽지 못한다. outcome summary의 pending performance도 실제 RPC 응답으로 확인한다.

**검증**:

- `supabase db push --local --dry-run`에서 production과 분리된 pending migration 12개를 확인했다.
- `supabase db push --local` 통과; migration history와 local Postgres를 사용했다.
- `pnpm run plus:activation:local` **exit 0 / ACT-001-lite PASS**:
  free 차단, active reviewed/current English receipt, retry idempotency, outcome summary,
  owner read, cross-owner isolation, free summary 차단, canceled Plus 차단을 모두 확인했다.
- 잘못된 `https`·경로가 붙은 local URL과 비-JWT key는 네트워크 호출 전에 fail-closed 됐다.
- 실행 후 read-only 조회에서 fixture translation **0건**, `act001-*` 임시 user **0명**,
  local receipt **0건**으로 cleanup을 확인했다.
- `node --check scripts/plus-activation-local.mjs`, scoped `eslint --no-ignore`,
  전체 173파일/1,196건 test, `tsc`, `lint` 0 errors/8 warnings, `build` 81/81,
  `git diff --check`가 통과했다. fresh `gpt-5.6-sol` high code review도 PASS다.

**운영 경계**:

이 루프는 local Supabase에만 migration을 적용하고 임시 fixture를 정리했다. production Supabase,
결제 provider, webhook, production translation publication, external post, push/merge/deploy는
수행하지 않았다. local ACT-001-lite는 production activation이나 실제 고객의 구독 가치를 증명하지
않으며, `ACT-001` human gate와 번역 448/1,520·누락 1,072건은 계속 열린다.

증적: `artifacts/renewal/loop-122/acceptance.md`, `artifacts/renewal/loop-122/verification.md`

## 루프 122 종료 상태

`code_complete` — 기존 글로벌 reviewed-current 콘텐츠와 Plus receipt/RLS 원장을 실제 local
Supabase 경로로 관통하는 재현 가능한 검증을 추가했다. full payment activation·production
translation supply·배포 완료는 선언하지 않는다.

## 마지막 검증 결과 (2026-08-09 루프 124, `artifacts/renewal/loop-124/verification.md`)

| 검사 | 명령 / 표면 | 결과 |
| --- | --- | --- |
| focused regression | `pnpm exec vitest run lib/plus-outcome-ledger.server.test.ts components/premium/plus-outcome-history.test.tsx components/premium/plus-outcome-follow-up.test.tsx components/premium/plus-outcome-snapshot.test.tsx components/premium/premium-dashboard-content.test.tsx lib/plus-next-move.test.ts` | ✅ **6 files / 38 tests** |
| 전체 단위/통합 테스트 | `pnpm test -- --reporter=dot` | ✅ **174 files / 1,213 tests** |
| 타입 | `pnpm exec tsc --noEmit` | ✅ 통과 |
| Lint | `pnpm lint` | ✅ 0 errors / 8 warnings (기존 warning) |
| 프로덕션 빌드 | `pnpm run build` | ✅ Next.js webpack, **81/81 static pages** (기존 metadataBase warning) |
| route smoke | 로컬 `next start -p 3100` + `SMOKE_BASE_URL=http://127.0.0.1:3100 node scripts/smoke.mts` | ⚠ **5/6**; `/rankings` 기존 `집계 기간` marker mismatch, SEO-001 soft-404는 known warning |
| diff 무결성 | `git diff --check` | ✅ 통과 |
| 독립 리뷰 | fresh `gpt-5.6-sol` high code-reviewer | ✅ PASS — 0 findings; prior review findings re-checked |

## 루프 124 — Plus Outcome History (2026-08-09)

Outcome Snapshot과 Follow-up은 최근 집계와 최대 5건의 후속 입력을 제공했지만, 사용자가
실제로 남긴 활용 receipt와 rating을 다시 찾을 수 있는 개인 작업 기억이 없었다. 이번 루프는
새 저장·분석·서버 write 없이 기존 원장을 `/premium`의 bounded history로 닫았다.

**구현**:

- `lib/plus-outcome-ledger.ts`에 history parser, deterministic sort, 30일/50건 limit, internal href gate를 추가했다.
- `lib/plus-outcome-ledger.server.ts`가 active Plus의 기존 `plus_meme_use_receipts`를 owner/RLS 범위에서 읽고 canonical detail link를 만든다. `result_url`·`private_note`는 select하지 않는다.
- `components/premium/plus-outcome-history.tsx`가 채널·평가 필터, 날짜·언어·산출물·성과 메모 상태, ready/empty/unavailable/locked를 표시한다.
- `app/(default)/premium/page.tsx`와 `PremiumDashboardContent`에 연결하고 ko/en/ja/zh/zh-tw fallback copy를 추가했다.

**운영 경계**:

새 DB/API/RPC/schema/migration/receipt write/analytics/OpenAI/publication은 추가하지 않았다.
authenticated Plus populated `/premium`, production RLS/receipt/payment와 live translation publication은
실행하지 않았으며 ACT-001·번역 human gate를 유지한다. `/rankings` smoke marker mismatch와 SEO-001
soft-404는 이번 루프 변경과 무관한 기존 문제로 남겼다.

증적: `artifacts/renewal/loop-124/acceptance.md`, `artifacts/renewal/loop-124/verification.md`

## 루프 124 종료 상태

`code_complete` — Plus Outcome History의 bounded read model과 filter surface를 local code 계약으로
완료했다. 글로벌 번역 448/1,520·누락 1,072행, authenticated Plus/RLS, production payment/receipt,
translation publication/deploy는 다음 human gate로 남긴다.

## 루프 123 — One-Cut prepared Creator Pack result reuse (2026-08-09)

Loop 120의 opt-in multi-card Creator Pack은 결과를 공유하거나 영수증을 저장한 뒤 같은 세션에서
다시 쓰려면 다시 export해야 했다. 이번 루프는 새 저장·분석·서버 호출 없이 이미 받은 Blob을 세션에
보존하는 단일 수직으로 닫았다.

**구현**:

- `components/premium/plus-global-action-inbox.tsx`가 성공한 Creator Pack의 `{ item, blob }`를
  session-only state로 유지한다.
- `Share prepared cards`는 retained Blob으로 native file share를 다시 열고, 불가하면 기존
  clipboard + download fallback을 재사용한다.
- 카드별 `Save card again`은 새 export/fetch 없이 retained Blob을 바로 저장한다.
- receipt가 성공하면 미완료 item만 completion UI에서 제거하고, 준비된 Blob·재공유·재다운로드
  control은 유지한다. 완료 추적 불가 경고는 미완료 item이 있을 때만 표시한다.
- 부분 export 실패 수, native share 취소, clipboard/download fallback 상태를 보존하며, 재공유
  중에는 share/download/create를 중복 실행할 수 없다.
- `lib/i18n-premium.ts`의 ko/en/ja/zh/zh-tw에 재공유·재저장·재사용 상태 copy를 추가했다.

**운영 경계**:

새 DB/API/RPC/schema/migration/receipt write/analytics/OpenAI/publication을 추가하지 않았다.
Blob은 브라우저 세션 수명에만 남고 새로고침·다른 기기·다른 사용자에게 전달되지 않는다.
authenticated Plus populated `/premium`와 실제 payment/entitlement는 local 환경에 fixture가 없어
이번 루프에서 실행하지 않았으며 ACT-001 human gate를 유지한다.

증적: `artifacts/renewal/loop-123/acceptance.md`, `artifacts/renewal/loop-123/verification.md`

## 루프 123 종료 상태

`code_complete` — One-Cut prepared Creator Pack 결과의 재공유·개별 재다운로드와 receipt 이후
재사용을 local UI 계약으로 완료했다. 글로벌 번역 448/1,520·누락 1,072행, authenticated Plus,
production payment/translation publication/deploy는 다음 human gate로 남긴다.

## 기준 검증 결과 (2026-08-09 루프 125, `artifacts/renewal/loop-125/verification.md`)

| 검사 | 명령 / 표면 | 결과 |
| --- | --- | --- |
| focused regression | `pnpm exec vitest run lib/plus-daily-signal-routing.test.ts lib/plus-daily-signal.server.test.ts lib/plus-global-action-inbox.test.ts components/premium/plus-global-action-inbox.test.tsx lib/plus-daily-signal-delivery.server.test.ts proxy.test.ts --reporter=dot` | ✅ **6 files / 87 tests** |
| 전체 단위/통합 테스트 | `pnpm test -- --reporter=dot` | ✅ **175 files / 1,228 tests** |
| 타입 | `pnpm exec tsc --noEmit --pretty false` | ✅ 통과 |
| lint | `pnpm lint` | ✅ 0 errors / 8 existing warnings |
| scoped lint | 변경 파일 `pnpm exec eslint` | ✅ 0 errors / 1 existing `<img>` warning |
| 프로덕션 빌드 | `pnpm build` | ✅ Next.js webpack, **81/81 static pages** (metadataBase 기존 warning); sandbox DNS 실패 뒤 권한 확장으로 재검증 |
| diff 무결성 | `git diff --check` | ✅ 통과 |
| 번역 공급 게이트 | `pnpm translation:check` | ⚠ 기존 artifact **448/1,520**, missing **1,072**, forbidden mutation **18**, non-machine reviewed publication 오류 1건 |
| Manual QA | local `next start -p 3100` + `curl` valid/invalid/duplicate Daily Signal + checkout paths | ✅ valid 307은 allowlisted `next=/premium?focus=meme-1&locale=en&from=daily_signal`, invalid/duplicate는 `next=/premium`, checkout은 `next=/premium?checkout=return` |
| 독립 리뷰 | fresh `gpt-5.6-sol` high code-reviewer re-review | ✅ **APPROVE** — prior 2 MEDIUM findings resolved; explicit duplicate focus/locale·checkout regression added |

## 루프 125 — Daily Signal focused One-Cut (2026-08-09)

Plus Daily Signal 이메일은 검수된 후보를 읽게 했지만, 사용자가 실제로 오늘 실행할 One-Cut까지
한 번에 이어지지 않았다. 이번 루프는 새 콘텐츠 생성·번역 공개·결제 변경 없이 기존 reviewed/current
delivery와 `/premium` Action Inbox를 연결하는 하나의 전환 수직으로 닫았다.

**구현**:

- `lib/plus-daily-signal-routing.ts`가 safe focus id와 5개 Daily Signal locale을 파싱하고
  `/premium?focus=...&locale=...&from=daily_signal`을 결정론적으로 만든다.
- Daily Signal text/HTML CTA는 기존 delivery server가 통과시킨 후보의 One-Cut URL을 사용한다.
  기존 한국어 canonical과 외국어 exact reviewed/current/source revision gate는 그대로 유지한다.
- Premium RSC는 메일의 locale을 명시적으로 우선하고, 실제 eligible Action Inbox 후보와 일치할 때만
  `preferredMemeId`를 첫 One-Cut으로 올린다. unknown/stale/completed/unsafe focus는 기본 정렬로
  fallback하며, 완료된 후보를 다시 실행하지 않는다.
- `proxy.ts`는 auth redirect에 허용된 Daily Signal/checkout path와 query만 safe `next` 안에 보존하고
  원래 query를 중복 전달하지 않는다. 로그인 전 Manual QA에서 실제 307 복귀 URL을 확인했다.
- One-Cut ready/prepared/receipt funnel events를 기존 analytics contract에 연결하되 개인 ID,
  본문, URL, receipt ID, private note를 보내지 않는다. 새 DB/API/RPC/schema/migration/write/
  OpenAI/publication 자동화는 없다.

**운영 경계**:

이번 루프는 local code·local production build/route만 검증했다. authenticated Plus populated
Action Inbox, RLS/entitlement/payment/receipt production write, 실제 이메일 relay 수신, live
translation supply/publication, production deploy는 수행하지 않았다. `translation:check`의 기존
448/1,520 artifact와 1,072 missing/18 mutation은 글로벌 human gate로 남긴다.

증적: `artifacts/renewal/loop-125/acceptance.md`, `artifacts/renewal/loop-125/verification.md`

## 루프 125 종료 상태

`code_complete` — Daily Signal을 읽기용 상세에서 focused One-Cut 실행면으로 연결하고, 인증 복귀·
source-gated eligible fallback·PII-free 퍼널 계측을 local 계약과 실제 307 route 관찰로 완료했다.
글로벌 번역 공급·authenticated Plus/RLS·payment/receipt production write·이메일 relay·production deploy는
이번 루프의 완료 선언에 포함하지 않는다.

## 루프 126 — Next Move in-place One-Cut activation (2026-08-09)

Loop 125에서 Daily Signal은 eligible 후보를 One-Cut 화면까지 연결했지만, ratings가 고른 Next
Move가 같은 화면의 상세 Use Kit 링크에서 멈춰 사용자가 다시 큐를 찾아야 했다. 이번 루프는
새 콘텐츠·번역·결제·서버 write 없이 이 마지막 실행 전환만 닫았다.

**수용 기준**:

- [x] `mode="one_cut"`이고 Next Move 후보가 현재 local Action Inbox에 있을 때만 inline activation
  button을 표시한다.
- [x] Creator Pack 준비/재사용, pending receipt, busy 상태에서는 기존 상세 링크와 현재 작업을
  보존한다.
- [x] activation은 후보를 첫 One-Cut 카드로 재배치하고 `include more` 및 meme별 usage example
  선택을 초기화한다.
- [x] activation 결과를 `role="status"`/`aria-live="polite"`로 알리고 첫 카드에 focus를 둔다.
- [x] full inbox, empty/saved-revisit, completed, unavailable 경로는 기존 상세 Use Kit link
  fallback을 유지한다.
- [x] 새 DB/API/RPC/schema/migration/write/analytics/OpenAI/publication 자동화가 없다.

**구현**:

- `PlusNextMoveCopy`에 5-locale activation/status copy를 추가하고, `PlusNextMove`가 optional
  `onActivate`를 받으면 accessible button을, 아니면 기존 internal `Link`를 렌더링한다.
- `PlusGlobalActionInbox`에 one-cut-only eligibility guard를 두고 current item membership,
  Creator Pack/prepared Blob/pending receipt lock을 확인한다.
- 선택된 `memeId`를 첫 카드로 stable reorder하고 추가 카드·예문 선택을 reset한다. 상태를
  live region으로 표시하고 first ActionCard에 focus를 이동한다.
- 실행 흐름과 link fallback을 `plus-next-move` 및 `plus-global-action-inbox` 회귀로 고정했다.

**검증**:

- focused `pnpm exec vitest run ...` **3 files / 49 tests passed**
- 전체 `pnpm test` **175 files / 1,230 tests passed**
- `pnpm exec tsc --noEmit --pretty false` **통과**
- `pnpm build` exit 0, TypeScript 포함, Next.js static generation **81/81**; 기존 `metadataBase`
  warning remains
- 변경 파일 scoped ESLint **0 errors / 1 existing `<img>` warning**
- `git diff --check` **통과** (기존 broad dirty worktree는 보존)
- 독립 `gpt-5.6-sol` high `code-reviewer` **PASS** — PLUS-046 eligible guard, lock/fallback,
  reset, accessibility와 no-write 경계에서 blocker 없음
- local component interaction에서 rating으로 두 번째 후보를 Next Move로 선택 → activation click →
  첫 ActionCard 재배치·status message를 관찰했다.
- 실제 local production `/en/premium` 브라우저 관찰은 `/login?next=%2Fpremium` 인증 gate까지
  확인했으며, credentials/OTP/우회 없이 중단했다. 따라서 authenticated Plus populated UI는
  `not_run`으로 남긴다.
- 번역 공급 checker는 이번 루프에서 실행하지 않았고, 기존 artifact **448/1,520**, missing
  **1,072**와 human publication gate를 유지한다.

**운영 경계**:

이번 루프는 client-side local state와 copy/test만 변경했다. production Supabase, payment provider,
receipt write, live translation supply/publication, external post, deploy, commit/push는 수행하지
않았다. authenticated Plus UI 관찰에는 사용 가능한 테스트 자격증명이 없어, 브라우저 로그인 우회나
임시 Auth/OTP를 생성하지 않았다.

증적: `artifacts/renewal/loop-126/acceptance.md`, `artifacts/renewal/loop-126/verification.md`

## 루프 126 종료 상태

`code_complete` — Next Move를 eligible One-Cut 첫 카드로 인라인 활성화하고, 현재 작업 잠금·상태
알림·focus·기존 상세 fallback을 local code 계약으로 완료했다. 인증된 Plus populated UI, 글로벌
번역 공급, payment/receipt production write, production deploy는 이번 루프의 완료 선언에 포함하지
않는다.

## 루프 127 — zh Route-Unlock Operator Batch Lane (2026-08-09)

Loop 121의 route-unlock worklist와 Plus 번역 수요 큐는 각각 존재했지만, zh 운영자가 두 화면을
오가며 후보를 다시 고르고 저장 후 다음 원문을 수동으로 찾아야 했다. 이번 루프는 기존
GPT-5.6 Sol high preview·CAS 저장·human review gate를 유지한 채, 이 공급 병목만 하나의
결정론적 운영 배치로 연결했다.

**수용 기준**:

- [x] zh에서 translationStatus가 없는 Plus 요청 밈이 일반 누락 원문보다 먼저 정렬된다.
- [x] Plus 요청이 없으면 기존 route-unlock 후보 우선, `updatedAt desc`·`memeId asc` 순서를 유지한다.
- [x] 페이지 limit과 `focusMemeId` 첫 행 예약을 유지한다.
- [x] GPT preview는 운영자가 누른 행에만 실행되고, gpt-5.6-sol/high 계약과 원문 revision gate를 유지한다.
- [x] 저장은 기존 machine 초안 CAS 경로만 사용하며 reviewed/public route로 자동 전이하지 않는다.
- [x] zh 저장 성공 뒤 preview를 닫고 현재 배치의 다음 후보를 선택하되, 다음 GPT 호출은 명시적으로 요구한다.
- [x] Plus queue RPC unavailable은 empty와 별도 오류 표면으로 유지한다.
- [x] 새 DB/API/RPC/schema/migration/자동 번역/자동 발행을 추가하지 않는다.

**구현**:

- `prioritizeTranslationWorklistRows()`가 기존 route-unlock 정렬 결과를 stable partition하고, 서버 페이지가
  zh의 missing Plus 요청 ID만 전달한다. priority 입력은 UUID·최대 100건을 fail-closed 검증한다.
- `MissingTranslationDraftPreview`에 `ZH ROUTE-UNLOCK OPERATOR LANE`을 추가해 Plus 요청 배지,
  현재 후보 표시, preview→machine 저장→다음 후보 상태를 제공한다.
- 기존 `claimTranslationPriority`, `previewMissingMemeTranslationWithGpt`,
  `saveMissingMemeTranslationDraft`와 source/translation CAS를 그대로 재사용한다.

**검증**:

- focused **3 files / 32 tests passed**
- 전체 `pnpm test` **175 files / 1,234 tests passed**
- `pnpm exec tsc --noEmit --pretty false` **통과**
- 변경 파일 scoped ESLint **0 errors**
- `pnpm build` exit 0, TypeScript 포함, Next.js static generation **81/81**; 기존 metadataBase warning remains
- `git diff --check` **통과**
- component interaction에서 zh lane marker·Plus badge·preview·machine save·다음 후보 active state를 관찰했다.
- local production `/admin/translations`는 `307 → /login?next=%2Fadmin%2Ftranslations`로 인증 게이트까지 확인했다.
- fresh `gpt-5.6-sol` high `code-reviewer` **PASS — APPROVE**; 7개 파일에서 CRITICAL/HIGH/MEDIUM/LOW
  finding 0건, priority/focus/model gate와 machine-only/no-publication 경계를 확인했다.
- `pnpm translation:check`는 실행하지 않았고, 기존 checker artifact **448/1,520**, missing **1,072**와
  human translation publication gate를 유지한다.

**운영 경계**:

이번 루프는 local code·local production build/route와 component interaction만 검증했다. 실제 operator
자격증명/OTP, production Supabase/RLS write, live translation publication, payment/receipt, deploy,
commit/push는 수행하지 않았다. 다음 후보는 `PLUS-047` Localized Outcome Replay이며, full `ACT-001`
human gate와 글로벌 번역 공급 게이트는 닫히지 않았다.

증적: `artifacts/renewal/loop-127/acceptance.md`, `artifacts/renewal/loop-127/verification.md`

## 루프 127 종료 상태

`code_complete` — zh Plus 수요를 route-unlock 번역 운영 배치의 앞단에 연결하고, explicit GPT preview·
machine-only 저장·다음 후보 상태·focus/limit·unavailable 경계를 검증했다. live 번역 공급 수치 증가,
reviewed publication, authenticated operator UI, production deploy는 이번 루프의 완료 선언에 포함하지 않는다.

증적: `artifacts/renewal/loop-127/acceptance.md`, `artifacts/renewal/loop-127/verification.md`

## 루프 128 — Plus Localized Outcome Replay (2026-08-10)

`PLUS-047`은 Outcome History가 receipt locale의 실제 reviewed/current 공개 번역 상태를 검증한 뒤에만
localized detail link를 제공하도록 했다. `ko`는 canonical, 비한국어는 exact locale의 감사 메타데이터·
source revision·indexability를 모두 통과한 경우에만 localized path를 사용하고, stale/missing은 한국어
fallback, nested relation 판정 불가는 row-level unavailable로 닫았다. private note/result URL은 계속
select·DTO·UI에서 제외했다.

검증은 focused 2파일/25건, 전체 175파일/1,237건, tsc, scoped lint, build 81/81, diff check와 local
production route/auth smoke를 통과했다. 기존 translation checker baseline `448/1,520`, missing `1,072`,
forbidden mutation `18`과 reviewed publication·authenticated Plus·production deploy gate는 유지했다.

## 루프 129 — Plus Outcome Replay One-Cut (2026-08-10)

`PLUS-048`은 최근 30일 Outcome History의 `hit` 중 서버가 현재 상태를 재검증한 결과만 다시 실행하는
One-Cut을 추가했다. eligible row는 owner-scoped receipt와 exact receipt locale, `approved/limited`,
indexable source, `green/yellow`, `rising/active`, reviewed/current 공개 경로를 모두 통과해야 하며, `ko`는
canonical path를 사용한다. history CTA는 `replay`, `replay_locale`, `from=outcome_history`로만 구성되고
proxy와 Premium page가 중복·URL-shaped·Daily Signal 혼합 query를 함께 거부한다.

검증된 replay item은 UI locale과 receipt locale이 달라도 item locale을 유지해 Action Inbox의 첫 카드로
주입된다. 이전 channel을 Creator Pack 기본값으로 미리 채우고 기존 준비·export·receipt 흐름을 재사용한다.
오늘 완료 ID가 있거나 completion read가 unavailable이면 replay만 제외하고 일반 신호는 유지한다. public
short id만 DTO에 남기며 receipt id/private note/result URL은 노출하지 않는다. 새 DB/API/RPC/schema/
migration/write/AI/publication 자동화는 추가하지 않았다.

검증: focused 6파일/113건, 전체 176파일/1,250건, `tsc --noEmit`, full lint 0 errors/8 existing warnings,
scoped lint 0 errors, build 81/81, `git diff --check`, local `next start` replay/login redirect·mixed query
fail-closed·localized route 200 smoke, fresh `gpt-5.6-sol` high code review PASS/APPROVE를 통과했다. 실제
authenticated Plus receipt/RLS, payment, production translation supply/publication, operator 검수, deploy는
수행하지 않았다.

## 루프 129 종료 상태

`code_complete` — Outcome History hit에서 현재 안전·공개·언어 상태를 다시 확인해 Action Inbox와 Creator
Pack으로 연결하는 기억 루프를 local surface에 완성했다. 글로벌 번역 공급은 checker baseline `448/1,520`
중 `1,072` missing으로 남아 있고, live publication과 production deploy는 다음 human gate다.

## 루프 130 — ACT-001-RC Read-only Paid-value Preflight (2026-08-10)

`ACT-001-RC`는 실제 유료 가치 경로를 production에 쓰지 않고, preview target이 다음 증거를 모두 갖췄을 때만
READY가 되도록 만들었다. core relation은 `billing_*` billing path와 `plus_meme_use_completions`·
`plus_meme_use_receipts` 실제 테이블만 사용하며, `outcome_ratings`는 테이블로 오인하지 않고 실제 receipt
column/RPC migration으로 취급한다. core RPC는 authenticated preview JWT로 조회한 PostgREST OpenAPI
catalog에서 확인하고, `billing_subscriptions`·completion·receipt의 authenticated limit-0 read가 401/403이면
즉시 차단한다. supporting translation/digest/context relation은 `supportingDegraded`로 별도 표시한다.

release evidence는 preview·clean working tree·40자 commit SHA·Unifi test payment의
`payment→entitlement→eligible_action→receipt→outcome` 단계·provider/outcome/retention privacy 확인·target
migration ledger를 요구한다. 각 artifact는 evidence root 내부의 상대 경로만 허용하고 실제 바이트 SHA-256,
timestamp, realpath containment를 검증한다. `/en/pricing`·`/en/explore`·signed-out `/premium`은 GET/manual
redirect로 확인하고 세 route가 같은 `X-MemeCatch-Release-Sha`를 반환해야 한다. 모든 HTTP probe는 timeout을
가지며 POST/PUT/PATCH/DELETE와 credential 출력은 없다.

검증: preflight syntax/contract test·full 176파일/1,250건·tsc·lint 0 errors/8 existing warnings·build
81/81·diff check, fresh `gpt-5.6-sol` high review PASS/APPROVE, local `/en/pricing` 200·`/en/explore` 200·
`/premium` 307 login redirect를 확인했다. credential/evidence가 없는 local preflight는 의도대로
`ACT-001-RC BLOCKED`이며 Supabase schema/auth, release SHA, payment/privacy 이유를 출력했다. live는 현재
`/en/pricing` 404·`/en/explore` 404·`/premium` 307 login redirect여서 preview activation을 입증하지 않는다.

## 루프 130 종료 상태

`code_complete` — read-only preflight surface와 실패 증거를 완성했다. 실제 preview Supabase schema/RLS,
authenticated Plus receipt, Unifi test payment, target migration ledger, privacy/legal review, live translation
publication, production deploy는 수행하지 않았으며 `ACT-001-RC` human gate로 남긴다.

증적: `artifacts/renewal/loop-130/acceptance.md`, `artifacts/renewal/loop-130/verification.md`

## 루프 131 — LOC-024 Cross-locale Plus-demanded Translation Fulfillment (2026-08-10)

현재 Plus의 번역 요청은 `plus_translation_requests`에서 reviewed/current가 되기 전까지 대기하지만,
관리자 누락 worklist의 Plus 우선순위 반영은 `zh`에만 한정되어 있었다. 또한 준비된 `ja`·`zh`·`zh-tw` 번역은
사용자의 UI locale이 `en`이면 Action Inbox에서 제외되어, 구독자가 요청한 언어의 결과를 사용할 수 없었다.

이번 수직은 기존 수요 큐·source-depth/route-unlock·fulfillment 판정을 재사용한다. 운영자 페이지는 선택한
모든 SEO locale에 대해 `translationStatus=null`인 Plus 요청 밈만 우선화하고, machine/stale 행은 기존 검수
큐로 남긴다. Action Inbox는 ready 요청을 UI locale과 무관하게 유지하되, 같은 밈에 여러 ready 번역이 있으면
현재 UI locale을 먼저 선택하고 그 외에는 최신 deterministic row를 선택한다. 카드에는 실제 번역 locale을
언어명으로 표시하며, href/share text는 기존 exact localized path를 그대로 사용한다.

새 runtime table/API/schema와 production 적용은 추가하지 않았고, locale-scoped RPC는 배포 가능한 source
migration artifact로만 추가했다. production migration apply/write/AI/publication 자동화는 수행하지 않았다.
translation checker baseline `448/1,520`과 missing `1,072`, human pack/publication gate, ACT-001 preview/payment
gate는 변하지 않는다.

검증: focused 6파일/89건(서버 action·migration contract 포함), 전체 177파일/1,255건, `tsc --noEmit`, scoped lint 0 errors/1 existing `<img>`
warning, full lint 0 errors/8 existing warnings, build 81/81, `git diff --check`, local production
`/en/explore`·`/en/pricing` 200·signed-out `/premium` 307·`/admin/translations` operator login 307,
fresh `gpt-5.6-sol` high code review를 확인했다. 실제 operator session, authenticated Plus/RLS, 번역
publication, production deploy는 수행하지 않았다.

## 루프 131 종료 상태

`code_complete` — Plus 수요가 네 locale의 missing worklist와 준비된 cross-locale Action Inbox를 연결한다.
사용자 요청 번역의 실제 reviewed/public 공급 증가와 authenticated Plus receipt는 운영자 human gate로 남긴다.

증적: `artifacts/renewal/loop-131/acceptance.md`, `artifacts/renewal/loop-131/verification.md`

## 루프 132 — GLO-007 Source-locked Global Translation Draft Intake (2026-08-10)

글로벌 구독 가치의 병목은 화면 수가 아니라 실제 reviewed/current 콘텐츠 공급이다. 이번 루프는
현재 공개된 `fmbbud58`(트랄랄레로 트랄랄라) 한 건을 source snapshot에 잠그고, `en`·`ja`·`zh`·`zh-tw`
각 한 건씩의 machine draft를 사람이 검수할 수 있는 입력 pack으로 만들었다. live 페이지의
`updated_at=2026-07-15T15:30:00.191373+00:00`와 source fields를 모든 row에 복제했고, source에
usage example이 비어 있어 새 예문은 만들지 않았다.

`translation:intake` report-only는 scoped worklist 1건·4 row를 모두 통과시켰다. 각 locale은
`missingBefore=1`에서 `missingAfter=0`으로 줄었고, duplicate/source mismatch/out-of-worklist는 0건이다.
`--emit-artifact --require-complete`는 네 개 SQL 파일을 만들었으며, batch checker는 expected/actual
4건·forbidden mutation 0건·missing 0건으로 통과했다. SQL은 source revision/CAS와 approved/limited
guard를 유지하고, `status='machine'`, `reviewed_at=null`, `reviewed_by=null`, `on conflict do nothing`을
사용한다. 어떤 SQL도 실행하지 않았다.

프로덕션 읽기 전용 관찰에서는 canonical meme page 200, `/premium` 및 `/admin/translations` 307이었지만
`/en/explore`, `/en/pricing`, `/en/search?q=pepe`는 404다. 이는 로컬 route 변경이 배포되지 않은 상태의
증거이며, 이번 루프에서 deploy/publication/production write를 수행하지 않은 이유이기도 하다. 로컬
production build와 서버에서는 `/en/explore`, `/en/pricing`, canonical meme, search가 200이고 signed-out
Premium/admin은 login redirect 307이었다.

독립 `gpt-5.6-sol` high `code-reviewer`는 12개 산출물에서 source hash·locale 완결·SQL CAS·machine-only
경계를 재확인했고 `PASS`/critical-high-medium-low 0 findings를 반환했다. LSP는 Markdown/SQL/JSON 서버
미구성으로 진단하지 못했으나, intake/checker·전체 테스트·typecheck·lint·build·diff check와 HTTP GET QA는
완료했다.

## 루프 132 종료 상태

`code_complete` — source-locked 4-locale machine draft와 적용 전 SQL 검증 artifact를 완성했다. operator의
`gpt-5.6-sol` high 검수 승인, reviewed/current 공개, Supabase 적용, Plus authenticated fulfillment와
production deploy는 human gate로 남긴다. 기존 live reviewed translation baseline `448/1,520`과 missing
`1,072`는 이 한 건의 machine artifact로 변경되지 않는다.

증적: `artifacts/renewal/loop-132/acceptance.md`, `artifacts/renewal/loop-132/verification.md`,
`artifacts/renewal/loop-132/source-locked-pack.json`, `artifacts/renewal/loop-132/machine-sql/`

## 루프 133 — PLUS-049 One-Cut Result Evidence and Outcome History Reopen (2026-08-10)

Plus의 기존 receipt RPC와 result_url column을 재사용해 compact One-Cut을 실제 결과 증거 중심으로
좁혔다. One-Cut form은 결과 URL을 표시하고 mode=one_cut으로 보내며, API는 http:·https: URL이
없거나 안전하지 않으면 entitlement/RPC 전에 400으로 닫는다. 일반 bulk receipt와 mode 없는 legacy
요청은 선택 URL 동작을 유지한다.

Outcome History는 기존 owner-scoped receipt query에 result_url만 추가하고, parser가 protocol을 다시
확인한다. unsafe result_url 행만 filter하여 정상 행의 History가 전체 unavailable로 바뀌지 않게 했고,
private_note는 select·DTO에 넣지 않았다. UI는 저장된 결과만 target=_blank·noreferrer noopener
외부 링크로 열며, legacy/no-URL row는 명시적인 결과 링크 없음 상태를 보여준다. URL fetch, 자동 게시,
새 migration/schema/RPC, production write는 추가하지 않았다.

검증: focused 5파일·97건, 전체 177파일·1,260건, pnpm exec tsc --noEmit, scoped/full lint,
pnpm build 81/81, git diff --check를 통과했다. local production server에서
/en/pricing·/en/explore 200, signed-out /premium 및 /admin/translations 307 login redirect를
확인했다. 최초 독립 gpt-5.6-sol high review가 unsafe row filtering과 URL/legacy test gap을
지적했고, 둘 다 수정한 뒤 final re-review에서 PASS·critical/high/medium/low 0건을 확인했다.

## 루프 133 종료 상태

code_complete — One-Cut result evidence와 History reopen local surface를 완성했다. authenticated
Plus/RLS receipt, 실제 외부 플랫폼 게시 성공, preview payment, translation publication, production
deploy는 human gate로 남긴다.

증적: artifacts/renewal/loop-133/acceptance.md, artifacts/renewal/loop-133/verification.md

## 루프 134 — PLUS-050 Outcome Proof Snapshot (2026-08-10)

Loop 133에서 One-Cut에 저장하기 시작한 실제 결과 URL이 History 안에만 보이면, 구독 직후 사용자는
Plus가 축적한 결과 증거를 첫 화면에서 즉시 체감하기 어렵다. 이번 수직은 기존
owner-scoped·sanitized Outcome History DTO의 `resultUrl` 존재 여부만 집계해 Outcome Snapshot에
`저장된 결과` 수치를 추가하고, 하나 이상의 결과가 있을 때만 History anchor를 제공한다.

새 DB/API/RPC/schema/migration/write/analytics/OpenAI/publication은 추가하지 않았다. URL 자체·receipt ID·
private note는 Snapshot으로 전달하지 않으며, History의 locked/empty/unavailable 상태와 기존
http/https fail-closed parser를 그대로 사용한다. 다섯 locale의 결과 수치·History CTA copy를 추가했고,
결과 History가 `empty`이거나 성공적으로 `ready`된 History의 결과 수가 0일 때만 0건을 표시하며,
`locked`·`unavailable`이면 Snapshot 자체를 unavailable로 닫아 조회 실패를 0건으로 위장하지 않는다.
결과 수가 0이면 가짜 결과 링크를 만들지 않는다.

검증: focused Snapshot 6건, 전체 177파일·1,263건, `pnpm exec tsc --noEmit`, scoped/full lint
0 errors(기존 warning 8개), `pnpm build` 81/81, `git diff --check`를 통과했다. local production server에서
`/en/pricing` 200, `/zh-tw/pricing` 200, `/en/explore` 200, signed-out `/premium` 307 →
`/login?next=%2Fpremium`을 확인하고 임시 서버를 종료했다. 독립 `gpt-5.6-sol` high review는
artifact에 기록했으며, 실제 authenticated Plus/RLS·result URL 존재·외부 게시·production deploy는
이번 루프에서 증명하지 않는다.

## 루프 134 종료 상태

`code_complete` — 기존 private Outcome History를 재사용한 결과 증거 Snapshot surface를 완성했다.
실제 고객 receipt/RLS, 번역 publication, 외부 게시 성공, production deploy는 human gate로 남긴다.

증적: `artifacts/renewal/loop-134/acceptance.md`, `artifacts/renewal/loop-134/verification.md`,
`artifacts/renewal/loop-134/review.md`

## 루프 135 — PLUS-051 Outcome Rating Reopen (2026-08-10)

Loop 134에서 첫 화면에 저장 결과 수를 보여줬지만, Outcome History의 `Not rated` 기록은 여전히
평가 화면으로 이어지지 않았다. 이번 수직은 기존 owner-scoped History에 opaque `receiptId`만 보존하고,
`performanceRating === null`인 항목에만 `Rate this use` CTA와 `hit`·`neutral`·`miss` 선택을 제공한다.

평가는 기존 인증 API `/api/plus/outcome-ledger/rating`을 그대로 사용하고 응답의 `updated`·`receiptId`·
`performanceRating`을 모두 확인한다. 성공하면 이력 카드가 즉시 평가 상태로 바뀌고 `router.refresh()`가
서버 Snapshot의 평가 수를 다시 읽는다. `awaitingPerformanceCount`는 기존 `performance_note` 대기 수의
계약이므로 rating 저장만으로 그 수를 감소시키지 않으며, 성과 메모와 평가는 서로 다른 신호로 유지한다.

새 DB/API/RPC/schema/migration/analytics/OpenAI/publication은 추가하지 않았다. private note·성과 본문은
History DTO에 추가하지 않았고, 기존 결과 URL 안전 링크·localized/fallback link·hit replay 조건도 유지했다.
다섯 Premium locale의 CTA copy를 추가했으며, locked/empty/unavailable 또는 이미 평가된 행에는 CTA를
노출하지 않는다.

검증: focused History 6건, 전체 177파일/1,264건, `tsc --noEmit`, scoped/full lint 0 errors(기존 warning
8개), `pnpm build` 81/81, local production route smoke와 실제 브라우저 pricing/signed-out Premium QA를
통과했다. 독립 `gpt-5.6-sol` high `code-reviewer`는 PASS·0 findings를 반환했다. 인증된 Plus receipt POST,
RLS, 실제 외부 게시, 번역 publication, live deploy는 수행하지 않았다.

## 루프 135 종료 상태

`code_complete` — 미평가 Outcome History에서 rating을 기록하고 Snapshot 평가 수를 갱신하는 local surface를
완성했다. authenticated Plus/RLS와 실제 rating POST, production global route 공급, 번역 publication 및
production deploy는 별도 human gate로 남긴다.

증적: `artifacts/renewal/loop-135/acceptance.md`, `artifacts/renewal/loop-135/verification.md`,
`artifacts/renewal/loop-135/review.md`

## 루프 136 — GLO-008 Translation Supply Control Tower (2026-08-10)

관리자 번역 화면에는 Plus 수요 큐와 로케일 coverage 표가 각각 있었지만, 운영자가 글로벌 공급을 늘리기
위해 어느 로케일의 어떤 행을 먼저 열어야 하는지 한 번에 판단할 수 없었다. 이번 수직은 현재 작업 큐의
locale-scoped priority RPC와 Control Tower의 전역 active-demand read-only 조회를 분리하고, 공개 원문의
`isIndexableMeme()` 판정을 붙여 `translationStatus=null`인 `locale + memeId`를 route-unlock 후보로
표시했다. demand는 1000행 페이지네이션, 번역 상태는 200 meme-ID 배치로 읽고, 네 SEO locale의 Plus
요청·검토 필요·stale·누락·최신 검수 수치를 로케일별 다음 행동 링크로 합쳤다.

Control Tower는 오류를 빈 큐나 0건으로 대체하지 않으며, 누락 Plus 요청은 focus 검수 경로로, 기존 번역
요청은 밈 편집/검수 경로로 보낸다. GPT 초안 생성, machine 저장, reviewed 공개, audit/RPC write와
`gpt-5.6-sol` high 검수 계약은 기존 surface와 human gate를 그대로 유지한다. 새 migration·schema·
production write·publication·deploy는 수행하지 않았다.

검증: focused 4파일/36건(1,001행 page-2 후보 회귀 포함), 전체 179파일/1,270건, `tsc --noEmit`,
full lint 0 errors/8 existing warnings, production build 81/81, local `/en/explore`·`/en/search?q=pepe`·`/en/pricing`·`/zh-tw/explore` 200,
`content-language` 확인, signed-out `/admin/translations` 307 login redirect를 통과했다. live
`/en/explore`·`/en/pricing`·`/en/search` 404와 translation baseline `448/1,520`, missing `1,072`는
이번 루프에서 바꾸지 않았다. 독립 `gpt-5.6-sol` high re-review는 PASS/APPROVE·0 findings였다.

## 루프 136 종료 상태

`code_complete` — 글로벌 번역 공급의 다음 검수 행동과 Plus demand/route-unlock 후보를 관리자에서 함께
보여주는 local surface를 완성했다. operator authenticated session, source-locked machine pack의
실제 저장, human reviewed/current publication, live route 공급과 production deploy는 별도 human gate로
남긴다.

증적: `artifacts/renewal/loop-136/acceptance.md`, `artifacts/renewal/loop-136/verification.md`,
`artifacts/renewal/loop-136/review.md`

## 루프 137 — PLUS-052 First Outcome Activation Reliability (2026-08-10)

Plus 첫 화면은 이미 `Action Inbox → Creator Pack → 실제 사용 기록 → 결과/평가` 수직을 갖고 있었지만,
요청 로케일에 exact-current reviewed translation이 없으면 Global Scout가 empty가 되어 첫 actionable
outcome 자체가 사라졌다. 이번 수직은 새 추천·결제·게시 기능을 추가하지 않고, `ko`·`en`이 아닌 지원
로케일에서만 동일한 public/safe/content-depth/current source에 대해 영어 `reviewed` translation을
읽기 전용 fallback으로 사용한다. fallback row는 `locale="en"`으로 유지해 action과 detail link가
실제 영어 route를 가리키며, Scout와 One-Cut 카드에 콘텐츠 언어를 표시한다.

요청 로케일 조회가 `unavailable`이면 fallback으로 오류를 숨기지 않고 unavailable을 유지한다. 요청 로케일에
하나라도 eligible card가 있으면 fallback query를 실행하지 않는다. 새 DB/API/RPC/schema/migration/write/
analytics/OpenAI/publication은 추가하지 않았고, 기존 관리자 GPT 계약 `gpt-5.6-sol`·high·`store=false`도
변경하지 않았다.

검증: focused 5파일/166건, 전체 179파일/1,275건, `pnpm exec tsc --noEmit`, full lint 0 errors/8 existing
warnings, `pnpm build` 81/81, `git diff --check`를 통과했다. local production에서 `/en/explore`·`/ja/explore`·
`/zh-tw/search?q=pepe`·`/en/pricing` 200 및 signed-out `/premium`·`/admin/translations` 307 login redirect를
확인했다. live `/en/explore`·`/en/pricing`·`/en/search?q=pepe`는 여전히 404이며 배포하지 않았다.
독립 `gpt-5.6-sol` high review에서 최초 HIGH 1건(영어 fallback read error의 empty 위장)을 수정하고,
최종 re-review `PASS/APPROVE`·0 findings를 artifact에 기록했다. authenticated Plus/RLS·실제 영어 fallback
translation 공급·외부 게시·production deploy는 이번 루프에서 증명하지 않는다.

## 루프 137 종료 상태

`code_complete` — 번역 coverage가 비어도 exact-current 영어 검수 콘텐츠를 숨김 없이 안내해 첫 One-Cut
후보를 유지하는 local surface를 완성했다. human translation publication, live route 공급, production
deploy와 authenticated Plus/RLS는 별도 human gate로 남긴다.

증적: `artifacts/renewal/loop-137/acceptance.md`, `artifacts/renewal/loop-137/verification.md`,
`artifacts/renewal/loop-137/review.md`

## 루프 138 — PLUS-053 Premium First-Session Global Starter (2026-08-10)

Loop 137에서 번역 coverage가 비어도 첫 actionable card를 유지했지만, 구독자는 여전히 Premium에서
Global Daily로 이동해야 실제 검수 콘텐츠를 소비할 수 있었다. 이번 수직은 새 퀴즈·추천·결제·게시
기능을 만들지 않고 기존 `loadGlobalDailyChallenge`와 `GlobalDailyChallenge`를 Premium 첫 화면에
직접 임베드했다. active Plus는 Action Inbox/Outcome Snapshot 다음에 오늘의 3문제 세션을 보고,
각 문제를 풀고, 완료 후 첫 밈의 기존 `#meme-use-kit-title`로 이동한다.

Premium loader가 공급하는 `ready`·`completed`·`unavailable` 상태와 검수/current/safety gate,
기존 completion API·streak semantics를 그대로 사용한다. challenge node가 공급되는 경우에만 기존
`/daily` 이동 카드를 숨기며, loader가 unavailable이어도 준비 중 상태를 숨기지 않는다. free/non-premium
dashboard와 standalone `/daily`는 변경하지 않았다. 새 DB/API/RPC/schema/migration은 추가하지 않았다.

검증: focused page/dashboard/global-daily 14건, 전체 180파일/1,278건, `pnpm exec tsc --noEmit`, full lint
0 errors/8 existing warnings, 변경 파일
`pnpm build` 81/81, `git diff --check`를 통과했다. local production에서 `/premium` signed-out
307 login redirect와 `/en/explore`·`/ja/explore`·`/zh-tw/search?q=pepe` 200을 확인했다.
독립 `gpt-5.6-sol` high code review는 `PASS/APPROVE`·0 findings로 통과했다. authenticated Plus/RLS의
실제 challenge 공급·completion write와 production deploy는 이번 루프에서 증명하지 않는다.

## 루프 138 종료 상태

`code_complete` — 구독 직후 Premium 안에서 검수된 글로벌 콘텐츠를 바로 소비하고 기존 Use Kit으로 이어지는
첫 세션 surface를 완성했다. standalone `/daily`와 기존 채점 계약은 유지하며, authenticated Plus/RLS·실제
completion write·translation publication·live route 공급·production deploy는 별도 human gate로 남긴다.

증적: `artifacts/renewal/loop-138/acceptance.md`, `artifacts/renewal/loop-138/verification.md`,
`artifacts/renewal/loop-138/review.md`

## 루프 139 — PLUS-054 Premium Global Market Passport Handoff (2026-08-10)

Loop 138에서 Premium 안에서 Global Daily를 바로 풀 수 있게 했지만, 완료 뒤에는 첫 밈의 Use Kit으로
곧바로 이동해 그 밈이 어느 시장에서 어떻게 쓰이는지 확인하려면 다시 상세로 이동해야 했다. 이번 수직은
새 글로벌 feed나 학습 모델을 만들지 않고 기존 검수 데이터 기반 `MemeMarketPassport`를 완료 화면에
연결한다. active Plus의 `ready`·`completed` challenge에 첫 문항의 원본 ID가 있을 때만 read-only passport를
읽고, 사용자가 challenge를 완료했거나 이미 완료한 상태일 때만 시장별 프로필·현지 주의·검수된 변형을
보여준 뒤 기존 Use Kit handoff를 유지한다.

질문 메타데이터에는 Global Daily 원문을 식별할 수 있는 `id`를 optional로 전달하고, 이 값이 없는 경우에는
passport 조회 자체를 하지 않는다. free/non-Premium·signed-out·`unavailable`에서는 passport
조회가 없고, standalone `/daily`와 기존 completion POST/streak 계약도 변경하지 않았다. 새 DB/API/RPC/
schema/migration/write/AI/publication/deploy는 추가하지 않았다.

검증: focused 9파일/52건, 전체 181파일/1,283건, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`
81/81, `git diff --check`, local production `/premium` 307 및 `/en/explore`·`/ja/explore`·
`/zh-tw/search?q=pepe` 200. 완료 상태의 실제 Market Passport 렌더와 완료 전 비노출은 component interaction으로
확인했다. 독립 `gpt-5.6-sol` high code review는 artifact에 기록한다. authenticated Plus/RLS의 실제
passport 공급·completion write와 production deploy는 이번 루프에서 증명하지 않는다.

## 루프 139 종료 상태

`code_complete` — 구독자가 글로벌 밈을 푼 직후 시장별 의미·현지 주의·변형을 확인하고 기존 Use Kit으로
이어지는 Premium 학습 handoff를 완성했다. 검수 데이터가 없으면 loader가 `empty`로 닫고 합성 origin을
사용하지 않으며, human translation publication·live route 공급·authenticated Plus/RLS·production deploy는
별도 human gate로 남긴다.

증적: `artifacts/renewal/loop-139/acceptance.md`, `artifacts/renewal/loop-139/verification.md`,
`artifacts/renewal/loop-139/review.md`

## 루프 140 — PLUS-055 Premium Global Daily 3-Meme Review Shelf (2026-08-10)

Loop 139는 Premium Global Daily 완료 뒤 첫 문항의 Market Passport와 Use Kit을 연결했지만, 같은 세션에서
함께 검수한 두 번째·세 번째 문항은 완료 화면에서 소비되지 않았다. 이번 수직은 새 feed·추천·학습 저장소를
추가하지 않고 기존 `questions` 배열을 완료·already-completed 화면의 review shelf로 투영한다. active Premium
사용자는 세 문항을 원래 순서로 다시 보고, 각 문항의 정답 의미·안전 신호·현재 UI locale의 exact detail link를
통해 필요한 밈의 Use Kit으로 이어질 수 있다.

복습 shelf는 `showReviewShelf` opt-in으로 Premium page에만 연결하고 standalone `/daily`는 기존 완료 화면을
유지한다. 기존 첫 문항 Market Passport와 첫 문항 Use Kit handoff도 유지한다. `answerIndex`와 문항 필수
필드를 builder/shelf 경계에서 검증해 malformed 데이터는 빈 의미로 숨기지 않고 `unavailable`/shelf 비노출로
닫는다. 고유 `useId()` heading label, composite list key, 44px link target을 적용했다.

새 DB/API/RPC/schema/migration/write/AI/analytics/dependency/publication/deploy는 추가하지 않았다.

검증: focused 4파일/25건, 전체 181파일/1,291건, 단독 `tsc --noEmit`, lint 0 errors/8 existing warnings,
production build 81/81, `git diff --check`, local production `/premium` 307 및 `/en/explore`·`/ja/explore`·
`/zh-tw/search?q=pepe`·`/daily`·`/en/daily` 200. 독립 `gpt-5.6-sol` high `code-reviewer`는
`PASS/APPROVE`·0 findings를 반환했다. authenticated Plus/RLS·실제 completion write·Market Passport
공급·reviewed translation publication·live route 공급·production deploy는 수행하지 않았다.

## 루프 140 종료 상태

`code_complete` — Premium 구독자가 오늘 공급된 글로벌 밈 3개를 완료 후 모두 복습하고 exact-locale 상세와
기존 Use Kit으로 이어지는 local subscription-value vertical을 완성했다. standalone `/daily`와 기존
completion/streak 계약은 유지하며, production 데이터·인증된 Plus/RLS·번역 publication·live deploy는 별도
human gate로 남긴다.

증적: `artifacts/renewal/loop-140/acceptance.md`, `artifacts/renewal/loop-140/verification.md`,
`artifacts/renewal/loop-140/review.md`

## 루프 141 — PLUS-056 Route-safe Global Daily Review Shelf (2026-08-10)

Loop 140은 Premium 완료 화면에서 세 문항을 모두 복습하게 했지만, Global Daily 후보 공급 자체가 localized
detail route의 `isIndexableMeme()` source-depth 계약과 동일한지 보장하지 않았다. 이번 수직은 기존
`content-depth` 판정을 재사용해 thin source가 5개 locale translation을 갖고 있어도 Global Daily 후보가 되지
않도록 하고, 각 복습 CTA를 locale-safe `#meme-use-kit-title`로 직접 연결한다.

서버 loader는 기존 content-depth 관계를 읽기만 하며, Premium은 3개 Review Shelf를 opt-in으로 소비한다.
유효한 shelf가 있으면 first-only legacy next-step을 중복 노출하지 않고, malformed shelf는 shelf와 fallback을
함께 닫는다. standalone `/daily`, Market Passport, completion/streak, reviewed/current translation gate는
변경하지 않았다.

검증: 집중 3파일/24건, 독립 reviewer 집중 5파일/43건, 전체 181파일/1,292건, 단독 `tsc --noEmit`, lint
0 errors/8 existing warnings, build 81/81, `git diff --check`, local production `/premium` 307 및
`/en/explore`·`/ja/explore`·`/zh-tw/search?q=pepe`·`/daily`·`/en/daily` 200. 독립 `gpt-5.6-sol` high
`code-reviewer`는 `PASS/APPROVE`·0 findings를 반환했다.

## 루프 141 종료 상태

`code_complete` — Global Daily 공급과 Premium Review Shelf가 동일한 공개 상세 품질 계약을 사용하고, 세 문항이
각각 실제 Use Kit anchor로 이어지는 local subscription-value vertical을 완성했다. production reviewed/current
공급·authenticated Plus/RLS·completion write·translation publication·live route 공급·production deploy는
별도 human gate로 남긴다.

증적: `artifacts/renewal/loop-141/acceptance.md`, `artifacts/renewal/loop-141/verification.md`,
`artifacts/renewal/loop-141/review.md`

## 루프 142 — PLUS-057 Locale-Honest Premium Global Session (2026-08-10)

UI는 19개 로케일을 지원하지만 실제 검수 콘텐츠 공급은 `ko`, `en`, `ja`, `zh`, `zh-tw`의 5개 콘텐츠
로케일에 한정된다. 기존 Premium/standalone `/daily`는 UI-only 로케일에서 영어 콘텐츠를 사용하면서도
표시 언어·콘텐츠 언어·완료 경계를 하나의 locale로 취급할 여지가 있었다. 이번 수직은 기존 loader의
검수/current/source-depth 계약을 건드리지 않고 `displayLocale`과 실제 `contentLocale`을 분리한다.

- UI-only 로케일은 기존 exact reviewed/current 영어 콘텐츠를 사용하고 `Content language: English`를
  고지한다. 영어 fallback row를 새로 만들거나 Global Daily 후보 게이트를 완화하지 않는다.
- 실제 콘텐츠 로케일이 Global Daily/Scout의 `lang`, 상세·Use Kit 링크, completion POST `locale`, primary
  analytics `locale`을 결정한다. 표시 로케일은 날짜와 `display_locale` provenance에만 사용한다.
- Premium Global Daily·Global Scout와 standalone `/daily`에 display/content 경계를 연결하고, core 5개
  로케일의 기존 동작을 회귀 테스트로 고정했다.
- 새 DB/API/RPC/schema/migration/write/번역 발행/결제/외부 게시/production deploy는 추가하거나 실행하지
  않았다.

검증: PLUS-057 focused 3 files/36 tests, 전체 181 files/1,295 tests, `pnpm exec tsc --noEmit`, `pnpm lint`,
`pnpm build` 81/81, `git diff --check`, local production `/premium` 307·`/daily`·`/en/daily`·글로벌
public routes 200을 통과했다. `memecatch_locale=th`의 `/daily` SSR에서 `content-locale=en`,
`display-locale=th`, `lang=en-US`, Content language 고지를 확인했다. 독립 `gpt-5.6-sol` high
`code-reviewer`는 `PASS/APPROVE`·0 findings를 반환했다. authenticated Plus/RLS·실제 completion write·
translation publication·live route 공급·production deploy는 human gate로 남긴다.

## 루프 142 종료 상태

`code_complete` — UI-only 로케일에서도 구독자가 실제 검수된 영어 콘텐츠를 언어 혼동 없이 소비하고, 영어
상세·Use Kit·완료 원장으로 이어지는 locale-honest Premium session을 완성했다. 기존 5개 언어 Global Daily
검수 gate와 Scout error/empty semantics는 유지한다. production reviewed/current 공급·authenticated Plus/RLS·
completion write·translation publication·live route 공급·production deploy는 별도 human gate로 남긴다.

증적: `artifacts/renewal/loop-142/acceptance.md`, `artifacts/renewal/loop-142/verification.md`,
`artifacts/renewal/loop-142/review.md`

## 루프 143 — PLUS-058 Seven-Day Winning Replay (2026-08-10)

Premium에는 이미 Outcome Snapshot·History·Follow-up·Rating·Next Move·Replay가 있었지만, 사용자가
최근 좋았다고 평가한 활용을 다시 시작하는 진입점은 History 안에만 있어 구독 가치가 다음 사용으로
짧게 이어지지 않았다. 이번 수직은 새 성과 수집이나 새 추천 시스템을 만들지 않고 기존 안전한 Replay
경로를 Snapshot에 하나의 promotion으로 연결했다.

- `ready`인 7일 Summary와 owner-scoped History의 기간을 교집합으로 사용하고, `hit`·localized/current
  replay eligibility·안전 path를 통과한 최신 1건만 후보로 선택한다.
- 오늘 completion이 하나라도 있거나 completion read가 `unavailable`이면 promotion을 닫아 완료한
  항목을 다시 제안하지 않는다.
- Snapshot은 제목·사용일·채널·콘텐츠 언어·산출물과 “내 평가 기준이며 검증된 공개 성과가 아님”을
  표시한다. receipt ID·private note·performance note·result URL은 새 DTO/UI에 넣지 않는다.
- Replay query가 실제 Action Inbox에 활성화되면 Snapshot promotion을 숨기고, History는 `shortId +
  locale`가 모두 일치할 때만 `현재 실행 중`으로 표시해 동일 행동의 중복 CTA를 제거한다.
- 기존 `replay`, `replay_locale`, `from=outcome_history` 라우팅과 UI/content locale 분리를 재사용한다.
- 새 DB/API/RPC/schema/migration/write/결제/외부 게시/번역 발행/production deploy는 추가하거나 실행하지
  않았다.

검증: focused Premium page/Snapshot/History 3 files/20 tests, 전체 181 files/1,300 tests, `pnpm exec
tsc --noEmit`, `pnpm lint` 0 errors/8 existing warnings, `pnpm build` 81/81, `git diff --check`, local
production `/premium` 307·valid replay query 307·`/en/explore`·`/ja/explore` 200을 통과했다. 최종 독립
`gpt-5.6-sol` high `code-reviewer`는 `PASS/APPROVE`·0 findings를 반환했다. authenticated Plus/RLS·실제
receipt/completion write·외부 플랫폼 성공·translation publication·live route supply·production deploy는
확인하지 않았다.

## 루프 143 종료 상태

`code_complete` — 최근 7일에 사용자가 좋았다고 평가한 기록을 정직하게 다시 사용할 수 있는 Premium
promotion을 완성하고, 오늘 완료·read unavailable·활성 Replay·다국어 identity 경계를 fail-closed로
고정했다. 실제 성과를 검증했다고 주장하지 않으며, production 사용자에게 보이는 데이터 공급과 결제·
인증·RLS는 별도 human gate로 남긴다.

증적: `artifacts/renewal/loop-143/acceptance.md`, `artifacts/renewal/loop-143/verification.md`,
`artifacts/renewal/loop-143/review.md`

## 루프 144 — GLO-009 Route-Safe Market Passport Variants (2026-08-10)

Loop 143까지 Premium Global Daily 완료 후 Market Passport를 보여줬지만, 변형 관계가 `reviewed`라는
사실만으로 현재 locale의 상세 URL을 조합했다. 그러면 대상 번역이 누락·stale·필수 필드 부족·원문
source-depth 미달이어도 `/en|ja|zh|zh-tw/memes/...` 링크가 생길 수 있었다. 이번 수직은 새 Premium
패널을 추가하지 않고 기존 글로벌 handoff의 route 계약을 서버에서 확정했다.

- 한국어 target은 `isIndexableMeme()`를 통과한 approved/limited canonical 문서만 canonical href를 받는다.
- 비한국어 target은 기존 `getLocalizedSearchMemesResult()`의 exact reviewed/current·required-field·
  public/source-depth gate를 통과한 번역만 localized slug/title/href로 투영한다.
- Passport variant DTO에 서버 확정 `targetHref`를 넣고 컴포넌트는 URL을 재조합하지 않는다.
- localized target read가 `unavailable`이면 Passport도 명시적 unavailable 상태를 표시하며, coverage-empty만
  성공적인 “검수된 변형 없음”으로 표시한다.
- Premium Global Daily는 UI display locale이 아닌 실제 content locale을 Passport loader에 전달한다.
- 새 DB/API/RPC/schema/migration/write/결제/외부 게시/AI/번역 발행/production deploy는 추가하거나 실행하지 않았다.

검증: focused Passport/Premium 4파일·16건, 전체 181파일·1,304건, `pnpm exec tsc --noEmit`, changed-file
lint 및 full lint 0 errors/8 existing warnings, approved network build 81/81, `git diff --check`, local
production `/premium`·Replay redirect 307, `/en|ja/explore`·`/en|ja/daily` 200. 최초 sandbox build는
Supabase sitemap DNS 제한으로 중단됐고, read-only network escalation 후 동일 build가 통과했다. 독립
fresh `gpt-5.6-sol` high `code-reviewer`는 `PASS / APPROVE`로 unavailable/empty와 Korean thin target
지적 해소를 확인했다.

## 루프 144 종료 상태

`code_complete` — 글로벌 Market Passport가 실제 열 수 있는 검수된 변형만 제공하고, 번역 조회 장애를
빈 결과로 위장하지 않는 route-safe handoff를 완성했다. 인증된 Plus/RLS·실제 live passport/번역 공급·
번역 publication·receipt/completion write·production deploy는 별도 human gate로 남긴다.

증적: `artifacts/renewal/loop-144/acceptance.md`, `artifacts/renewal/loop-144/verification.md`,
`artifacts/renewal/loop-144/review.md`

## 루프 145 — ACT-001 Negative Receipt Integrity (2026-08-10)

Loop 144까지 Premium One-Cut·Creator Pack·Outcome History의 UI surface는 연결되어 있었지만, 동일일
receipt가 이미 존재하면 입력의 의미 필드를 다시 확인하지 않고 성공을 반환할 수 있었다. 그러면 사용자가
다른 채널·콘텐츠 언어·산출물·결과 URL을 제출해도 기존 기록을 재사용한 것처럼 보일 수 있다. 이번 수직은
새 Premium 패널을 추가하지 않고 paid-value 경로의 성공 의미를 먼저 고정했다.

- 새 `20260810100000_plus_meme_use_receipt_integrity.sql`이 `channel`·`locale`·`artifact_kind`·
  `result_url`·`performance_note`·`private_note` 여섯 필드를 canonical trim 값으로 비교한다.
- 동일 의미 retry만 `already_recorded=true`로 반환하고, 차이가 있으면 `receipt_conflict`를 반환한다.
  race-safe `ON CONFLICT DO NOTHING` 이후에도 동일 비교를 수행하며 receipt UPDATE는 없다.
- Action Inbox completion API는 `receipt_conflict`를 409로 변환하고, Receipt Form은 5개 콘텐츠 언어의
  명시적 conflict 안내를 표시한다.
- local ACT-001 runner는 실제 `creator_pack` receipt를 사용하고, `p_channel` 변경 retry·free/canceled/
  cross-owner·canonical read-back·receipt/completion cleanup 검증을 포함한다.
- 새 Premium 카드·결제·webhook·production write/deploy·번역 publication·외부 게시 자동화는 추가하지 않았다.

검증: focused receipt/API/UI/migration 4파일·20건, 전체 183파일·1,308건, `pnpm exec tsc --noEmit`,
full lint 0 errors/8 existing warnings, `pnpm build` 81/81, `node --check scripts/plus-activation-local.mjs`,
`git diff --check`, local production `/premium` 307 및 `/en/explore`·`/en/daily` 200. 최초 독립
`gpt-5.6-sol` high review의 BLOCK 1건·MEDIUM 2건을 수정한 뒤 최종 재검수 `PASS/APPROVE`를 받았다.
로컬 Supabase CLI crash와 `LOCAL_SUPABASE_*` 미설정으로 실제 RPC/JWT/RLS runtime은 실행하지 않았다.

## 루프 145 종료 상태

`code_complete` — paid receipt가 의미가 다른 retry를 성공으로 위장하지 않도록 API·UI·SQL contract와
검수 runner를 닫았다. 이는 full `ACT-001` payment→entitlement→One-Cut→receipt나 production activation을
증명하지 않으며, preview 결제 자격·clean RC·실제 authenticated session·번역 publication·production
deploy는 별도 human gate로 남긴다.

증적: `artifacts/renewal/loop-145/acceptance.md`, `artifacts/renewal/loop-145/verification.md`,
`artifacts/renewal/loop-145/review.md`

## 루프 146 — PLUS-059 Global One-Cut Channel Draft (2026-08-10)

Loop 145까지 Creator Pack의 채널 선택은 `story`/`card` export 규격만 바꾸고, 공유 문안은 모든 채널에서
같은 순서를 사용했다. 이번 수직은 새 생성기나 게시 연동을 추가하지 않고 기존 Action Inbox → Creator Pack
흐름의 선택 채널을 검수된 초안 구조에 연결했다.

- `instagram`·`tiktok`·`youtube`는 짧은 시각형, `threads`·`x`는 짧은 소셜형, `community`·`messaging`은
  대화형, `blog`는 장문형, 나머지는 일반형으로 분류해 같은 검수 문장을 채널 목적에 맞는 순서로 배치한다.
- `buildPlusCreatorPack()`이 선택 채널을 `buildPlusDailySharePack()`에 전달하고, 기존 reviewed/current facts와
  사용자가 고른 reviewed usage example만 사용한다. 검수 예문이 없으면 새 문장을 만들지 않는다.
- 기존 `story`/`card` export, exact current detail path, one-cut preview, clipboard/share/download, receipt 확인과
  analytics payload를 유지한다. 5개 콘텐츠 locale의 설명도 검수된 문장 기반의 채널별 초안임을 명시한다.
- 새 DB/API/RPC/schema/migration/write/payment/webhook/AI 생성/번역 publication/외부 게시 자동화/production
  deploy는 추가하거나 실행하지 않았다.

검증: focused 4 test files/154 tests, 전체 183 files/1,311 tests, `pnpm exec tsc --noEmit`, `pnpm lint`
0 errors·8 existing warnings, `pnpm build` 81/81, `git diff --check`, local production HTTP에서 `/premium` 로그인
게이트 도착 및 `/en/explore`·`/en/daily`·`/ja/explore`·`/zh/explore`·`/zh-tw/explore` 200을 확인했다.

## 루프 146 종료 상태

`code_complete` — Creator Pack의 선택 채널이 검수된 공유 초안 순서와 기존 이미지 export에 함께 반영되며,
one-cut 실제 클릭 흐름에서 선택 채널의 detail link가 safety 문구보다 먼저 복사되는 계약을 고정했다. 실제
authenticated Plus/RLS·receipt/completion write·결제 activation·번역 공급/publication·외부 플랫폼 게시·
production deploy는 이번 루프에서 증명하지 않았고 별도 human gate로 남긴다. 독립 `gpt-5.6-sol` high
`code-reviewer`는 duplicate detail path 수정 후 `PASS/APPROVE`를 반환했다.

증적: `artifacts/renewal/loop-146/acceptance.md`, `artifacts/renewal/loop-146/verification.md`,
`artifacts/renewal/loop-146/review.md`

## 루프 147 — PLUS-060 Global Daily → One-Cut Activation (2026-08-10)

Loop 146까지 Premium Global Daily 완료 화면은 기존 3문항의 뜻·안전 신호와 Use Kit만 다시 열 수
있었다. 이번 수직은 이미 같은 loader에서 검수·current·source-depth를 통과한 당일 문항을 기존
One-Cut Action Inbox로 직접 이어, 구독자가 학습 후 바로 채널별 Creator Pack을 준비할 수 있게 했다.

- `loadGlobalDailyChallenge()`가 이미 읽은 12개 검수 후보를 DTO로 보존하고, 완료 화면에서는 실제
  3개 문항과 후보 ID·slug·title·safety·lifecycle을 다시 대조한다.
- `green`/`yellow` + `rising`/`active`인 후보만 서버 확정 `from=global_daily`·실제 content locale
  handoff를 받는다. UI-only locale은 URL·Action Inbox·receipt locale에 사용하지 않는다.
- review shelf의 One-Cut CTA는 검증된 후보에만 보이며, Action Inbox에서는 같은 밈을 Scout/Signal/
  Fulfillment와 중복하지 않고 첫 카드로 승격한다. Global Daily handoff는 translation DTO에 없는
  `usage_examples`를 새로 만들거나 전달하지 않는다.
- 기존 localized detail/Use Kit, channel-aware Creator Pack, explicit receipt와 analytics를 그대로
  재사용한다. 잘못된 focus·source 배열·지원하지 않는 locale·다른 날짜/문항·red/gray/cooling/
  archived·completion unavailable은 promotion을 닫는다.
- 새 DB/API/RPC/schema/migration/write/payment/AI 생성/번역 publication/외부 게시 자동화/production
  deploy는 추가하거나 실행하지 않았다.

검증: focused 7 test files/87 tests, 전체 183 files/1,321 tests, `pnpm exec tsc --noEmit`, `pnpm lint`
0 errors·8 existing warnings, production build 81/81, `git diff --check`, local dev `/premium` login
gate·`global_daily` return 및 `/en/explore`·`/en/daily`·`/ja/explore`·`/zh/explore`·`/zh-tw/explore` 200을 확인했다.
`next start -p 3100`은 현재 Next 16/Serwist 산출물의 루트 `prerender-manifest.json` 부재로 기동하지 못했다.

## 루프 147 종료 상태

`code_complete` — Global Daily 완료·재방문 선반에서 실제 검수 문항만 One-Cut으로 보내고, Premium page가
현재 challenge·content locale·safe/active·completion 상태를 재검증한다. 수동 query 승격은 `completed`·
completion available·정확히 3개의 유효 문항과 후보 대조를 모두 요구하며, ready 상태에서는 preferred action과
`entry_source=global_daily`를 닫는다. 독립 `gpt-5.6-sol` high 최종 리뷰는 `PASS/APPROVE`·0 findings를
반환했다. authenticated Plus/RLS·실제 completion/receipt write·결제 activation·번역 공급/publication·
외부 플랫폼 게시·production deploy는 이번 루프에서 증명하지 않았고 별도 human gate다.

증적: `artifacts/renewal/loop-147/acceptance.md`, `artifacts/renewal/loop-147/verification.md`,
`artifacts/renewal/loop-147/review.md`
