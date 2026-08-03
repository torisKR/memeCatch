# 루프 024 — 2차 병렬 감사 종합 (design-2-synthesis)

9건의 §6~§10 감사 결과를 통합해 신규 backlog 후보 10건을 도출했다. 형식은
`docs/renewal/BACKLOG.md`와 동일 — 그대로 승격 가능하게 맞췄다. 우선순위는
LOOP.md 식 `(user_impact × max(data_risk, traffic_weight) × confidence) / effort`.
ID는 기존 `BACKLOG.md` + `artifacts/renewal/loop-023/audit-synthesis.md`에 이미
쓰인 번호(DQ-001~016b, DES-001~004, PERF-001~002, A11Y-001~010, SEO-001)와
겹치지 않게 다음 빈 번호부터 배정했다. 인용된 파일:줄은 전부 이 저장소에서
직접 재확인했다(spot-check, 아래 각 항목의 근거 참조).

**감사 9건 중 1건은 후보 0건** — `app/[locale]` 하드코딩 한국어 문구 감사는
버그 0건으로 확인 완료. 유일한 한글 리터럴(`app/[locale]/page.tsx:203`)은
`aria-hidden` + `lang="ko"` 장식 워터마크로 의도된 설계다. 남은 8건 감사에서
10개 후보를 뽑았다.

---

## 요약 (우선순위 내림차순)

| ID | 문제 한 줄 | 사용자영향 | 위험 | 트래픽 | 확신 | 노력 | 점수 | 상태 |
| --- | --- | :-: | :-: | :-: | :-: | :-: | -: | --- |
| A11Y-012 | 터치 대상 44px 미달 4곳 | 3 | 1 | 3 | 5 | 1 | **45.0** | ready |
| DES-007 | 카드 제목 truncate 시 전체 제목 노출 수단 없음 | 2 | 1 | 4 | 5 | 1 | **40.0** | ready |
| PERF-003 | 상세 스켈레톤이 실제 렌더 구조와 어긋남(CLS 위험) | 3 | 1 | 4 | 5 | 2 | **30.0** | ready |
| DES-009 | 불완전 문서 표시가 LOOP.md §4 4필드 구조 미충족 | 3 | 2 | 5 | 4 | 2 | **30.0** | ready(부분 HG 대기) |
| PERF-004 | route별 First Load JS 기준선 없음 | 2 | 1 | 3 | 4 | 1 | **24.0** | ready |
| DES-005 | 탐색 결과 수 미표시 | 3 | 1 | 3 | 5 | 2 | **22.5** | ready |
| SEO-002 | 얇은 문서에도 완전한 구조화 데이터가 나감(화면과 신호 불일치) | 2 | 3 | 5 | 4 | 2 | **20.0** | ready |
| DES-006 | 카드 신호 5종(기본)·3종(컴팩트) 동시 경쟁 | 3 | 1 | 4 | 3 | 3 | **12.0** | ready |
| A11Y-011 | 외부 embed iframe 런타임 실패 시 클라이언트 폴백 없음 | 2 | 1 | 3 | 3 | 3 | **6.0** | ready |
| DES-008 | Pretendard 서체 선언이 데드코드(실사용 0) | 1 | 1 | 2 | 4 | 2 | **4.0** | ready |

---

## `A11Y-012` — 터치 대상 44px 미달 4곳

**문제**: `min-h-11`(44px) 규약을 실제로 지키지 않는 인터랙티브 요소 4곳. 히트박스
확장 없이 요소 자체가 32px 이하다.

- `components/export-button.tsx:213-214` — 닫기 `<button aria-label="close">`가 `h-8 w-8`(32px)
- `components/hero-web3.tsx:97` — 검색어 예시 `<Link>` 3개가 `min-h-8`(32px), 패딩 없음
- `components/submit-form.tsx:470` — 파일 업로드 `file:h-8`(32px) 의사요소 버튼(실제 클릭 대상)
- `components/source-evidence.tsx:37` — 출처 링크 `<a>`가 `min-h-6`(24px)

이미 같은 파일군에 해법 선례가 있다 — `components/coupang-dock.tsx:78`은 버튼
자체는 `h-6 w-6`이지만 `before:absolute before:-inset-2.5`로 히트박스를
약 44px까지 확장해 규약을 우회 없이 충족한다.

LOOP.md §8: 「touch target은 모바일에서 충분히 큼」 위반.

- 사용자 영향: 3 — 모바일에서 탭 실패를 유발할 수 있으나 보조 UI 위주
- 데이터/법적 위험: 1
- 트래픽 가중치: 3 — 4개 컴포넌트가 여러 화면(내보내기 모달·홈·제보 폼·상세)에 분산
- 해결 확신: 5 — `coupang-dock.tsx:78`의 히트박스 확장 패턴을 그대로 재사용 가능
- 예상 노력: 1 — className 4곳 조정
- 우선순위 점수: 45.0
- 의존성: 없음
- 완료 조건: 4곳 모두 `min-h-11`/`min-w-11` 또는 의사요소 히트박스 확장으로 44px 이상이 된다.
- 검증 명령: `npx vitest run` · 4개 컴포넌트 계산된 히트박스 크기 재측정
- 근거: 이번 세션에서 4곳 모두 `grep -n`으로 직접 재확인.

---

## `DES-007` — 카드 제목 truncate 시 전체 제목을 볼 방법이 없다

**문제**: `MemeCard`·`MemeCompactCard` 둘 다 제목을 `line-clamp-2`로 CSS 클램프만
할 뿐 `title` 속성이나 툴팁이 없다.

- `components/meme-card.tsx:73` — `<p className="line-clamp-2 ...">{meme.title}</p>`
- `components/meme-compact-card.tsx:58` — 동일 패턴
- 두 파일 전체에 `title=` 속성 0건(grep 확인)

`line-clamp-2`는 시각적 클램프일 뿐 DOM 텍스트를 제거하지 않으므로 카드를
감싸는 `<Link>`의 접근 가능한 이름에는 전체 제목이 들어가 스크린리더는 우연히
전체를 듣는다. 하지만 **마우스로 보는 사용자는 2줄 넘는 제목을 확인할 수단이
전혀 없다** — `title` 속성 부재로 네이티브 툴팁도 없다.

LOOP.md §6: 「긴 카드 제목은 잘리지 않거나 접근 가능한 전체 title 제공」 부분 미충족.

- 사용자 영향: 2 — 긴 제목 케이스에만 영향
- 데이터/법적 위험: 1
- 트래픽 가중치: 4 — 두 카드 컴포넌트가 홈·탐색·랭킹 전역에서 재사용
- 해결 확신: 5 — `title={meme.title}` 한 줄 추가로 해결
- 예상 노력: 1
- 우선순위 점수: 40.0
- 의존성: 없음
- 완료 조건: 두 카드의 제목 `<p>`(또는 감싸는 `<Link>`)에 `title={meme.title}`이 추가된다.
- 검증 명령: `npx vitest run`
- 근거: `components/meme-card.tsx:73`, `components/meme-compact-card.tsx:58` 직접 확인, `title=` 속성 0건 grep 확인.

---

## `PERF-003` — 상세 스켈레톤이 실제 렌더 구조와 어긋난다 (CLS 위험)

**문제**: 정적 대조로 확인된 두 불일치, 방향이 서로 반대다.

1. **`AnswerCardSkeleton`이 실컨텐츠보다 작다.** `components/skeletons.tsx:47-54`는
   4블록(뱃지·제목·요약·`h-14` 바)만 렌더하는데, 실제 `AnswerCard`
   (`components/answer-card.tsx:52-54`)는 `border+padding` 래퍼 안에
   `SignalTrace size="lg"`(`components/signal-trace.tsx:71` → `h-14`)를 렌더한다.
   이 파형 블록 전체가 스켈레톤에 대응 요소가 없다 — 로딩→실콘텐츠 전환 시
   콘텐츠가 스켈레톤보다 커져 아래로 밀림(CLS).
2. **`MemeDetailSkeleton`은 반대로 실콘텐츠보다 크다.** `components/skeletons.tsx:59-68`가
   `AnswerCardSkeleton` 다음에 `h-11` 바 4개짜리 카드를 렌더하는데, 실제
   `app/(default)/memes/[key]/page.tsx`의 `AnswerCard → ReactionBar → 임베드 →
   UsageExamples → SourceEvidence` 흐름에 대응하는 4-row 카드가 없다.

- 사용자 영향: 3 — 모든 상세 최초 로드에서 레이아웃 점프 가능성
- 데이터/법적 위험: 1
- 트래픽 가중치: 4 — 상세는 핵심 사용자 과업 route
- 해결 확신: 5 — 정적 대조로 원인이 명확(파형 블록 추가, 대응 없는 블록 제거/교체)
- 예상 노력: 2 — `components/skeletons.tsx` 한 파일 수정
- 우선순위 점수: 30.0
- 의존성: 없음
- 완료 조건: `AnswerCardSkeleton`에 `SignalTrace` 자리(`h-14`, border+padding 포함)가 추가되고, `MemeDetailSkeleton`의 대응 없는 `h-11×4` 블록이 제거되거나 실제 다음 섹션(예: `ReactionBar`)에 맞게 교체된다.
- 검증 명령: `npx vitest run` · DevTools MCP `performance_start_trace`로 상세 route CLS 콜드 캐시 재측정(PERF-002 절차 재사용)
- 근거: `components/skeletons.tsx:47-68`, `components/answer-card.tsx:52-54`, `components/signal-trace.tsx:71` 전부 이번 세션에서 `grep -n`/`sed -n`으로 직접 재확인.

---

## `DES-009` — 불완전 문서 표시가 LOOP.md §4의 4필드 구조를 충족하지 못한다

**문제**: LOOP.md §4는 불완전 문서에 다음 4필드를 요구한다.

```
확인 완료: 한 줄 뜻, 대표 원본
추가 확인 중: 최초 유행 시점, 직장 사용 예시
마지막 검수: 2026-07-15
제보가 필요한 내용: 실제 사용 문장
```

실제 `components/doc-status-note.tsx:24-48`(96.3% 공개 문서에 렌더 — 루프 001
기준선, `LOOP_STATE.md` 위험 2번)는 **부족한 것(`missing[]`) 목록 하나만** 보여준다.
「확인 완료」 긍정 목록, 「마지막 검수」 날짜, 「제보가 필요한 내용」을 「추가 확인
중」과 분리해 보여주는 필드가 전부 없다 — 이번 세션에서 파일 전체를 직접 읽어 확인.

이미 이 감사 배치의 다른 sub-agent가 설계안을 완성해 뒀다 —
`artifacts/renewal/loop-024/incomplete-doc-v2.md`. 그 설계는:
- 「확인 완료」·「추가 확인 중」을 기존 신호(`meme.summary`, `signals.mediaCount`,
  `signals.sourceCount`, `signals.tagCount`, 기존 `missing[]`)에서만 파생 — 새 로직 없음
- 「마지막 검수」는 **HUMAN_GATE로 보류** — `meme.updated_at`은 있지만 사람 검수와
  자동 레코드 갱신을 구분하는 필드가 없어, 이걸 「검수」로 표기하면 LOOP.md 절대규칙
  5(확인되지 않은 것을 확인됐다고 표시 금지)를 어길 위험이 있다고 설계 단계에서
  스스로 지적함

- 사용자 영향: 3 — LOOP.md 명시 요구사항 미충족, 96.3% 문서에 노출되는 컴포넌트지만 기존에도 `missing[]`은 있어 완전 공백은 아님(부분 개선)
- 데이터/법적 위험: 2 — 「마지막 검수」 필드를 설계 단계에서 이미 HUMAN_GATE로 걸러 정직성 리스크를 사전 차단했음을 반영
- 트래픽 가중치: 5 — 공개 문서 96.3%
- 해결 확신: 4 — 설계안 존재 + 기존 신호만 사용. 단 「마지막 검수」 필드는 부분 구현으로 남음
- 예상 노력: 2 — 설계안 기반, `doc-status-note.tsx` 한 파일 확장(확인 완료/제보 필요 분리)
- 우선순위 점수: 30.0
- 의존성: 「마지막 검수」 필드는 신규 HUMAN_GATE 후보(가칭 HG-009 — 검수 타임스탬프 필드 부재) 대기. 「확인 완료」·「추가 확인 중」·「제보 필요」 3필드는 게이트 없이 진행 가능.
- 완료 조건: `DocStatusNote`가 확인 완료·추가 확인 중·제보가 필요한 내용 3필드를 기존 신호에서 파생해 표시한다(마지막 검수는 HG-009 결정 후).
- 검증 명령: `npx vitest run components`
- 근거: `components/doc-status-note.tsx` 전체 직접 열람, `artifacts/renewal/loop-024/incomplete-doc-v2.md` 요약.
- 미해결 메모(설계안이 넘긴 것): `meme.summary` 공란율을 프로덕션에 실측 질의하지 않음 — 다음 루프에서 확인 필요.

---

## `PERF-004` — route별 First Load JS 크기 기준선이 없다

**문제**: LOOP.md §9 「route별 client bundle 축소」 우선순위 항목을 판단할 근거
자체가 없다. 현재 `.next/build-manifest.json`에는 route별 바이트 크기가 없고,
App Router 크기 매핑에 필요한 `.next/app-build-manifest.json`이 이 빌드 산출물에
없다. `grep -rl "First Load JS" artifacts/renewal` 결과 0건 — 과거 어떤 루프도
route별 크기를 기록한 적이 없다(`LOOP_STATE.md` 루프 014 검증 로그도 “빌드 성공”만
있고 표는 없음).

- 사용자 영향: 2 — 간접(회귀를 못 잡으면 실제 저하로 이어질 수 있음)
- 데이터/법적 위험: 1
- 트래픽 가중치: 3 — 전 route 로드에 영향
- 해결 확신: 4 — PERF-001과 같은 패턴(재빌드 콘솔 출력 캡처 + 기록), 코드 변경 없음
- 예상 노력: 1 — `next build` 재실행 후 콘솔 표를 아티팩트에 저장
- 우선순위 점수: 24.0
- 의존성: 없음(재빌드는 소스 미변경 측정 작업 — LOOP.md 절대규칙 위반 아님)
- 완료 조건: `next build --webpack` 콘솔의 route별 First Load JS 표가 아티팩트에 저장되고, 상위 5개 route가 `BASELINE.json`에 기록된다.
- 검증 명령: `npx next build --webpack` (콘솔 출력 캡처)
- 근거: 원 감사가 `.next/build-manifest.json` 전체·`find .next -maxdepth 1`·`grep -rl "First Load JS" artifacts/renewal` 결과를 인용. 이번 세션에서는 재검증하지 않음(재빌드가 필요해 범위 밖).

---

## `DES-005` — 탐색 결과 수 미표시

**문제**: `/explore`가 필터 적용 후 몇 건이 남았는지 전혀 보여주지 않는다.

- `components/explore-grid.tsx:102-166`(`buildMemesQuery`)와 `:171-174`(`fetchFrom`)
  어디에도 PostgREST `count` 옵션이 없다 — `.select(exploreSelect(...))`만 있고
  `{ count: "exact" }` 등은 이번 세션 `sed -n`으로 직접 확인해도 없음
- `components/explore-filters.tsx` 전체에 「개」·「건」 같은 count 텍스트 없음(grep 0건)

LOOP.md §6: 「결과 수 제공」 명시 요구사항 미충족.

- 사용자 영향: 3
- 데이터/법적 위험: 1
- 트래픽 가중치: 3 — 탐색은 핵심 보조 흐름
- 해결 확신: 5 — PostgREST `count` 옵션 추가 + 텍스트 노출이면 됨(원인·해법 모두 명확)
- 예상 노력: 2 — 무한스크롤 특성상 정확한 count 처리(첫 페이지 요청에만 count 요청 등) 고려 필요
- 우선순위 점수: 22.5
- 의존성: 없음
- 완료 조건: 탐색 화면에 현재 필터 기준 총 결과 수가 노출된다. 무한스크롤 로딩과 count 쿼리가 성능을 눈에 띄게 저하시키지 않는다.
- 검증 명령: `npx vitest run` · `/explore` 필터 조합별 표시 count와 실제 반환 건수 대조
- 근거: 이번 세션에서 `buildMemesQuery`/`fetchFrom` 전체 코드와 `explore-filters.tsx` grep 결과 직접 확인.

---

## `SEO-002` — 얇은 문서에도 완전한 구조화 데이터가 나가 화면과 신호가 어긋난다

**문제**: `app/(default)/memes/[key]/page.tsx:106`은 `isIndexableMeme(meme)`이
거짓일 때만 `robots: { index: false, follow: true }`를 붙인다. 바로 아래
`page.tsx:189-197`의 `<MemeWebPageJsonLd>` 호출은 **같은 조건문 밖에 있어
무조건 렌더된다** — 바로 위 줄(`page.tsx:188`, `{isIndexableMeme(meme) &&
<AdsenseScript />}`)은 조건부인데 JSON-LD만 조건이 빠졌다. 이번 세션에서
`sed -n`으로 정확히 확인 — `AdsenseScript`는 `&&` 가드가 있고 바로 다음
`MemeWebPageJsonLd`는 없다.

`components/json-ld.tsx:203-212`의 `mainEntity`(`DefinedTerm`)는 완전한 형태로
채워진다 — “아직 정리 중”이라는 신호가 없다. 화면 쪽은 같은 문서에서
`DocStatusNote`(`components/doc-status-note.tsx:36`)가 “아직 정리 중인 문서예요”를
띄우는데, 그 판정은 공개 문서의 **96.3%**에 해당한다(HG-001 근거 재사용).
이 JSON-LD는 파일 주석(`components/json-ld.tsx:19-21` 대역, 원 감사 인용)에
따르면 JS 미실행 AI 크롤러 대응이 목적 — 즉 `robots: noindex`를 존중하지 않을
수 있는 크롤러에게 정확히 완결 엔티티로 보인다.

LOOP.md §10: 「보강 중 문서의 metadata가 완료된 문서처럼 과장되지 않도록」 위반.

- 사용자 영향: 2 — 주로 크롤러 대상, 사람 사용자 직접 영향은 적음
- 데이터/법적 위험: 3 — GEO/AI 크롤러 대상 정직성 이슈, DQ-002/HG-001과 직결
- 트래픽 가중치: 5 — 96.3% 문서에 해당
- 해결 확신: 4 — `isIndexableMeme(meme)` 조건으로 `mainEntity`(또는 `MemeWebPageJsonLd` 전체)를 감싸면 됨, 이미 바로 옆에 같은 패턴(`AdsenseScript`)이 있음
- 예상 노력: 2 — `page.tsx`·`json-ld.tsx` 조건 분기 추가
- 우선순위 점수: 20.0
- 의존성: 없음(HG-001과 관련은 있으나 이 변경 자체는 게이트 대상 아님 — 편집 임계값이 아니라 기존 판정 함수를 구조화 데이터에도 적용하는 것)
- 완료 조건: `isIndexableMeme(meme)`이 거짓인 문서는 `MemeWebPageJsonLd`의 `mainEntity`를 생략하거나 완전성 신호를 낮춘다. 화면의 `DocStatusNote` 노출 여부와 구조화 데이터의 완결성 신호가 일치한다.
- 검증 명령: `npx vitest run` · 얇은 문서 1건의 렌더된 JSON-LD `<script>` 태그 육안 대조
- 근거: `app/(default)/memes/[key]/page.tsx:104-115`, `:186-198`, `components/json-ld.tsx:181-218` 전부 이번 세션 `sed -n`으로 직접 재확인.

---

## `DES-006` — 카드 신호 5종(기본)·3종(컴팩트)이 한 카드에서 동시 경쟁한다

**문제**: `MemeCard`(`components/meme-card.tsx`)는 기본 상태에서 최소
category(`:54`)·rank(`:59-67`, `aria-hidden` span + `sr-only` 별도)·safety(`:80`)·
lifecycle(`:81`) **4종**이 항상 동시 노출되고, 플랫폼 필터 문맥에서는
source platform(`:55`)이 더해져 **5종**이 된다. `MemeCompactCard`
(`components/meme-compact-card.tsx`)도 rank(`:39-53`)·lifecycle(`SignalTrace`,
`:62`)·safety(`:63`) **3종**이 좁은 `aspect-[4/5]` 카드 안에서 경쟁한다.

LOOP.md §6: 「category, lifecycle, usage signal을 한 카드에서 과도하게
경쟁시키지 않음」 위반. 단 어떤 신호를 줄일지는 편집 판단이 필요해 해결
확신을 낮게 잡았다.

- 사용자 영향: 3
- 데이터/법적 위험: 1
- 트래픽 가중치: 4 — 두 카드 컴포넌트가 홈·탐색·랭킹 전역 재사용
- 해결 확신: 3 — 무엇을 줄이거나 우선순위화할지 디자인 판단이 필요(코드 문제가 아니라 정보 위계 문제)
- 예상 노력: 3 — 여러 사용처(홈 스트립·탐색 그리드·랭킹)에서 시각 회귀 확인 필요
- 우선순위 점수: 12.0
- 의존성: 없음(LOOP.md HUMAN_GATE 목록에 해당 없음 — 데이터·산식 변경 아닌 UI 배치 변경)
- 완료 조건: 두 카드에서 동시 노출 신호가 각각 3종/2종 이하로 줄거나, 2차 신호가 hover/탭 확장 등으로 지연 노출된다.
- 검증 명령: `npx vitest run` · 반응형 스크린샷(390×844·768×1024) 전후 대조
- 근거: 이번 세션에서 `grep -n`으로 두 파일의 신호 렌더 라인 전부 직접 재확인.

---

## `A11Y-011` — 외부 embed iframe 런타임 실패 시 클라이언트 폴백이 없다

**문제**: `components/meme-embed.tsx`의 두 `<iframe>`(`:440` LiteSocialEmbed,
`:536` LiteYouTube — 이번 세션 grep으로 확인) 어디에도 `onError` 핸들러가 없다.
oEmbed 서버 검증(`error` state, `:460-479`)은 **요청 단계** 실패만 잡는다 —
iframe이 DOM에 꽂힌 뒤 브라우저에서 로드 실패(네트워크 차단·삭제된 영상·region
block)하면 빈 프레임으로 남을 수 있다. 서버측 실패·원본 소실 케이스는 이미
폴백이 있다(`:104-141` 타이포 폴백, `:460-479` 에러 카드) — 이 항목은 그
바깥의 클라이언트 런타임 실패만 다룬다.

LOOP.md §8: 「외부 embed에는 title과 대체 경로 제공」 중 대체 경로의 남은
구멍. (같은 감사가 다룬 live region 명시성 이슈는 원 감사 스스로 “실측 필요,
결론 보류”라고 명시해 이 종합에서는 채점하지 않았다 — 근거 없는 주장 금지 원칙.)

- 사용자 영향: 2 — 드문 케이스(네트워크 차단·삭제 영상)
- 데이터/법적 위험: 1
- 트래픽 가중치: 3 — 상세 페이지 핵심 콘텐츠 영역
- 해결 확신: 3 — cross-origin iframe의 로드 실패 감지는 브라우저 지원이 제한적(단순 `onError`가 항상 발동하지 않을 수 있어 타임아웃 보강이 필요할 수 있음)
- 예상 노력: 3 — `onError` + 필요 시 타임아웃 기반 감지
- 우선순위 점수: 6.0
- 의존성: 없음
- 완료 조건: iframe 로드 실패(또는 일정 시간 내 미로드) 시 기존 에러 카드(`:460-479` 패턴)로 전환된다.
- 검증 명령: `npx vitest run` · 네트워크 차단 시뮬레이션 수동 확인
- 근거: `components/meme-embed.tsx` 전체 `onError` grep 0건 이번 세션 직접 확인.

---

## `DES-008` — Pretendard 서체 선언이 데드코드다 (실사용 0)

**문제**: `app/globals.css:101`이 `--font-sans: "Pretendard Variable", Pretendard, system-ui, ...`를
선언하고 `:105`가 `body`에 적용하지만, 저장소 어디에도 이 폰트를 실제로
로드하는 코드가 없다 — `next/font` import 없음, `@font-face`/`preload` 0건,
`public/`에 폰트 파일 없음, `package.json`에 `pretendard` 의존성 없음(원 감사가
`grep -rn`으로 전수 확인, 이번 세션에서는 결론에 영향 없는 재빌드 불필요
항목이라 재검증하지 않음 — CSS 선언 자체는 코드 열람만으로 충분히 확인 가능한
정적 사실). 유일하게 “Pretendard”를 fetch하는 코드는 og:image 생성용 서버
API(`opengraph-image.tsx`, `export/route.ts`)뿐 — 페이지 렌더링과 무관.

결과: 모든 사용자가 `system-ui`/`Apple SD Gothic Neo`/`Malgun Gothic` 폴백으로
본다. FOUT/FOIT 위험은 없지만(애초에 로드를 시도하지 않으므로), 디자인이
의도한 서체가 실제로 아무에게도 적용되지 않는다.

- 사용자 영향: 1 — 시스템 폰트 폴백도 가독성상 무난, 실사용자 피해는 낮음
- 데이터/법적 위험: 1
- 트래픽 가중치: 2 — 전역 CSS지만 시각적 임팩트는 낮음(브랜드 일관성 문제)
- 해결 확신: 4 — 원인은 명확하나 방향(폰트를 실제로 로드 vs CSS 선언을 시스템 폰트로 정리)은 디자인 결정
- 예상 노력: 2
- 우선순위 점수: 4.0
- 의존성: 없음(단, "실제로 Pretendard를 쓸 것인가"는 브랜드 방향 확인이 선행되면 더 좋음 — 게이트는 아님)
- 완료 조건: CSS의 `--font-sans` 선언이 실제 로드되는 폰트와 일치한다(로드하거나, 선언에서 뺀다).
- 검증 명령: `npx next build --webpack` · 렌더된 페이지에서 실제 적용 폰트 계측
- 근거: 원 감사의 `grep -rn "@font-face|font-display|preload.*font|Pretendard"` 전수 결과 인용. `app/globals.css:101,105`는 이번 세션에서도 재확인.

---

## 메모 — 이번 종합에서 backlog화하지 않은 것

- **app/[locale] 하드코딩 한국어 문구**: 0건, 버그 아님(확인 완료). 후속 조치 불필요.
- **meme-embed.tsx live region 명시성**(`role="status"` vs 명시적 `aria-live`, DOM
  교체 방식의 announce 신뢰성): 원 감사가 스스로 “실측(스크린리더 테스트) 없이는
  결론 내리지 않는다”고 명시. 근거 없는 주장 금지 원칙에 따라 점수화하지 않았다.
  실측 방법이 생기면 A11Y 후보로 재검토.
- **PERF-004의 원인**(재빌드 없이는 route별 크기를 낼 수 없음) 자체는 결함이
  아니라 측정 인프라 공백이라 PERF-004로 등록했다(위 표 참고) — 별도 메모 불필요.
