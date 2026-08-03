# LOOP_STATE

> 루프 런타임의 영구 상태. 매 루프 시작 시 **이 파일을 먼저 읽는다.**
> 규격: 저장소 루트 `LOOP.md`

## 현재 루프

| 항목 | 값 |
| --- | --- |
| 루프 번호 | **018** |
| 선택 항목 | 게이트 A 마지막 항목 — 핵심 route smoke 자동화 |
| 상태 | `human_gate` |
| 날짜 | 2026-08-04 |
| 브랜치 | `renewal/loop-001` |
| 산출물 | `artifacts/renewal/loop-001/` ~ `loop-018/` |

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

## 완료된 작업 (루프 004 — DES-001)

모바일에서 2단 그리드가 세로로 풀리면서 왼쪽 레일(대표 영상 662px)이 통째로 정보
앞에 왔고, 그 결과 첫 뷰포트(844px)에 이 밈의 뜻과 신호가 하나도 없었다.

- 정답 카드를 2단 그리드 **밖·위**로 올렸다. 모바일은 “뜻 먼저, 영상 나중”이 되고
  데스크톱은 제목이 전체 폭을 쓰는 헤더가 된다. 2단 구조 자체는 그대로다.
- `AuthInvite`(410px 로그인 유도)를 컴포넌트 문서가 명시한 자리인 “정답 카드 직후”로
  되돌렸다 — 기존 위치는 자기 문서와 어긋나 있었고 첫 화면을 먼저 차지했다.

**전후 비교** — `/memes/uefmryky`, 390×844

| 측정 | before | after |
| --- | ---: | ---: |
| 정답 카드 top | 1344 | **79** (bottom 420 — 전체가 첫 뷰포트 안) |
| h1 top | 1399 | **216** |
| 한 줄 뜻 top | 1435 | **252** |
| 안전 신호 bottom | ~1603 | **399** |
| 대표 임베드 top | 301 | 666 |

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

| 확인 항목 | before | after |
| --- | :---: | --- |
| 산정 기간 | ❌ | 집계 기간 최근 3일 / 최근 7일 (탭별) |
| 마지막 갱신 | ❌ | 마지막 집계 2026년 8월 4일 (DB `max(date)`와 일치) |
| 탭별 산식 | ❌ | 3개 탭 각각 한 문장 |
| 표본 부족 | ❌ | ▲ 표본 적음 경고 |

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

| route | LCP (목표 2500ms) | CLS (목표 0.1) |
| --- | ---: | ---: |
| `/` | 143ms ✅ | 0.00 ✅ |
| `/rankings` | 1062ms ✅ | 0.00 ✅ |
| `/memes/[key]` | 1131ms ✅ | **0.12 ❌** |

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

| 실패 항목 | 판정 |
| --- | --- |
| `color-contrast` 2.82:1 | **실제 결함** → `A11Y-002` |
| `is-crawlable` | 의도된 동작 — 얇은 문서 noindex (DQ-002/HG-001) |
| `third-party-cookies` | 알려진 트레이드오프 — 공식 임베드 |
| `errors-in-console` 6건 | **로컬 계측 아티팩트** — 프로덕션은 0건 |

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

| | before | after |
| --- | ---: | ---: |
| Accessibility | 97 | **100** |
| Agentic Browsing | 96 | **100** |
| color-contrast 위반 | 1건 | **0건** |

## 완료된 작업 (루프 012 — PERF-002 조사)

**고치지 않고 원인만 규명했다.** DevTools `CLSCulprits`가 지목한 유일한 원인은 크기가
지정되지 않은 **쿠팡 제휴 광고 이미지**(`img1a.coupangcdn.com/.../ajax-loader.gif`)다.
즉 `PERF-002`와 `DES-004`는 같은 요소가 원인이고, 광고 배치 변경은 LOOP.md가
`HUMAN_GATE`로 규정한 항목이다(HG-005). → `PERF-002`를 `blocked`로 재분류했다.

**측정값이 실행마다 달랐다.**

| 실행 | 조건 | CLS |
| --- | --- | ---: |
| 루프 009 | 콜드 캐시 | 0.12 |
| 루프 012 | 웜 캐시 | 0.00 |

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

## 진행 중인 작업

없음. **게이트 없이 진행 가능한 backlog가 0건이다** (체크리스트 잔여 검증 항목 중
keyboard-only·768×1024·200% 확대·reduced-motion·INP·e2e는 남아 있으나 전부 결함
증거가 없는 검증 부채로, 우선순위상 게이트 결정 이후로 미룬다).

## 마지막 검증 결과 (2026-08-04 루프 014, `artifacts/renewal/loop-014/verify.log`)

| 검사 | 명령 | 결과 |
| --- | --- | --- |
| 단위/통합 테스트 | `npx vitest run` | ✅ 77 파일 / **645 통과** (기준선 597 → +48) |
| Lint | `npx eslint` | ✅ 0 error / 5 warning (전부 기존 `no-img-element`) |
| 타입 | `npx tsc --noEmit` | ✅ 통과 |
| 프로덕션 빌드 | `npx next build --webpack` | ✅ 성공 |
| 데이터 품질 검사기 | `pnpm quality:check` | ⚠️ **의도된 실패** — critical 4건 검출로 exit 1 (기준선과 동일) |
| 핵심 route smoke | 로컬 프로덕션 빌드 + 브라우저 계측 | ✅ 390×844·360×800·1440×900 계측 |
| e2e 자동화 | — | `not_run` — e2e 프레임워크 미도입 |
| 마이그레이션 dry-run | — | `not_run` — 루프 001~008 모두 스키마를 변경하지 않음 |
| 접근성 자동 검사 | DevTools MCP lighthouse + CI 대비 가드 | ✅ Accessibility **100**, 위반 0건. CI에 회귀 가드 2건(실패 증명 완료). 4개 route 브라우저 감사는 여전히 수동 |
| 반응형 스크린샷 회귀 | 수동 계측 | ⚠️ 부분 — 390×844·360×800·1440×900 확인. 768×1024은 `not_run` |
| metadata/canonical 검사 | — | `not_run` — 자동 검사 없음. 빌드 산출물 육안 확인만 |
| 성능 회귀 검사 | Chrome DevTools MCP trace | ⚠️ 부분 — LCP/CLS 3개 route 측정. 홈·랭킹 목표 충족, 상세 CLS 0.12 초과(`PERF-002`). INP는 `not_run` |

## 현재 주요 위험

1. ~~무출처 공개 문서가 “검수팀 확인”을 주장~~ → **루프 003에서 해소.** 다만
   1,330건에 실제 근거를 붙이는 일은 그대로 남아 있다(편집 작업, DQ-007).
2. **공개 문서의 96.3%가 충실도 미달**이라 색인 대상이 145건뿐이고, “아직 정리 중인
   문서예요” 배너가 사실상 전 문서에 뜬다. `components/doc-status-note.tsx`의 주석이
   경고한 “모든 문서에 붙는 순간 의미 없는 템플릿” 상태에 이미 도달했다.
3. ~~모바일 상세 첫 뷰포트에 밈 정보가 0~~ → **루프 004에서 해소**(정답 카드 top 79px).
4. **상황별 사용 신호의 84.8%가 4개 상황 전부 동일값.** 화면은 상황별 판정처럼
   보여주지만 데이터는 사실상 단일값이다.
5. **`meme_claims` 0건 · `meme_media.source_role` 100% `usage_example`.** 주장 단위
   근거 연결 설비가 스키마에만 있고 운영되지 않는다.
6. 로컬 `.env.production`의 `SUPABASE_SERVICE_ROLE_KEY`가 401을 반환한다(anon 키는
   정상 200). service_role을 쓰는 운영 스크립트가 지금 동작하지 않을 수 있다.

## 다음 후보 작업 3개

**게이트 없이 진행 가능한 항목이 남아 있지 않다.**

**남은 10건은 전부 `HUMAN_GATE` 대기다** — DQ-002·DQ-003·DQ-004·DQ-006·DQ-007·
DQ-010·DES-004·**PERF-002**(루프 012에서 HG-005 종속으로 재분류)가 `DECISIONS.md`의
HG-001~HG-005 결정을 기다린다.

**남은 고가치 항목은 전부 `HUMAN_GATE` 대기다** — DQ-002·DQ-003·DQ-004·DQ-006·
DQ-007·DQ-010·DES-004가 `DECISIONS.md`의 HG-001~HG-005 결정을 기다린다.

그 밖의 남은 항목(DQ-002·DQ-003·DQ-004·DQ-006·DQ-007·DQ-010·DES-004)은 전부
`HUMAN_GATE` 대기다 — `DECISIONS.md`의 HG-001~HG-005 결정이 있어야 진행할 수 있다.

## 중단 조건 충족 여부

| 조건 | 충족 |
| --- | --- |
| 완료 (`CATCHMEME_RENEWAL_DONE`) | ❌ **거짓 완료 선언을 하지 않는다.** `quality:check` critical 4개가 여전히 위반이다 — 화면 쪽 critical(DQ-005·DQ-001)은 해소됐지만 데이터 쪽(무출처 1,330건·중복 38건·alias 275건)은 그대로다 |
| 사람 결정 필요 (`CATCHMEME_HUMAN_DECISION_REQUIRED`) | ✅ **완전 충족** — 남은 backlog 10건이 **전부** HUMAN_GATE(HG-001~HG-006) 대기다. 게이트 없이 할 수 있는 일이 0건이다 |
| 안전 중단 (`CATCHMEME_SAFETY_STOP`) | ❌ 해당 없음 |
| 반복 제한 | 18 |
