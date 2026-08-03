# 신뢰 패널 설계안 — operator-first (DQ-010)

> LOOP.md §3 「이 설명을 믿을 수 있는 이유」 접이식 패널. 소스 미수정, 설계안만.
> 근거는 전부 프로덕션 anon 키 read-only 조회(2026-08-04) 또는 file:line 인용.

## 0. 결론 먼저

**대체 없음. 흡수 없음. 위임형 신설.** `TrustNote`·`SourceEvidence`·`DocStatusNote`
셋 다 그대로 둔다(코드 변경 0줄). 새 `TrustPanel`은 셋이 이미 하는 말을 반복하지
않고, **셋 중 누구도 지금 말하지 않는 사실만** 추가한 뒤 나머지는 링크로 위임한다.
이유는 §2에서 근거로 뒷받침한다 — 셋 다 이미 테스트가 있고(trust-note.test.tsx 7건,
doc-status-note.test.tsx 3건) 각자 존재 이유가 되는 코멘트를 파일 안에 갖고 있다.
합치면 그 코멘트가 거짓말이 된다.

`meme_media.source_role`(6,111건 전부 `usage_example`)과 `meme_revisions`는
**둘 다 이 패널의 데이터 소스가 될 수 없다** — §1에서 실측으로 확인.

---

## 1. 데이터 현실 감사 (실측)

프로덕션 PostgREST, anon 키, GET만. 원 문서에 적힌 수치를 재확인하고 필드 단위로
공개 읽기 가능 여부를 다시 쟀다.

| 테이블/필드 | RLS(anon) | 실측 | 근거 |
| --- | --- | --- | --- |
| `meme_media.source_role` | **전면 차단** — `for all using (is_operator())` | `GET /meme_media?select=source_role` → `content-range: */0` (0행) | `supabase/migrations/20260723120000_source_pipeline.sql:153-155` |
| `meme_revisions` | **전면 차단** (기본 deny) | `GET /meme_revisions?select=*&limit=1` → `[]` (에러 아님, 빈 배열) | 실측, `docs/renewal/DECISIONS.md` DQ-010 서술과 일치 |
| `meme_sources.copyright_status` | **공개 읽기 허용** | 4,608행 전수 조회 → `embeddable` 4,315 / `unknown` 293 | 실측(페이지네이션 5회), enum 정의 `lib/database.types.ts:1918-1922` |
| `memes.moderation_status` | 공개 읽기 허용(공개 문서는 항상 `approved`\|`limited`) | — | `lib/queries.ts:58` `PUBLIC_STATUSES = ["approved","limited"]`, 상세 쿼리 200행에서 이 필터로 조회 |
| `memes.updated_at`/`created_at` | 공개 읽기 허용, 이미 상세 쿼리에 포함 | — | `lib/queries.ts:198` `select("*, meme_contents(*), meme_sources(*), ...")` — `memes(*)`라 두 필드 모두 이미 응답에 있다 |

**핵심 발견 — `meme_media`는 "데이터가 비어서" 못 쓰는 게 아니라 "테이블 자체가
운영자 전용이라 anon 키로는 항상 0행"이다.** DQ-010/DECISIONS.md가 인용한
"6,111건 전부 `usage_example`"이라는 수치는 이 문서를 쓰는 시점에 anon 키로는
재현되지 않는다(마이그레이션의 `for all` 정책이 SELECT까지 막는다) — 즉 그 수치는
서비스 롤 또는 운영 콘솔에서 관측된 값이고, **공개 화면은 애초에 이 테이블을 볼 수
있는 경로가 없다.** 데이터를 채워도 RLS 정책을 바꾸지 않는 한 패널에 못 쓴다. 이건
데이터 품질 문제가 아니라 스키마 경계 문제라서, "채워지면 쓰겠다"가 아니라
"이 테이블은 애초에 후보가 아니다"로 결론을 좁힌다.

반대로 `meme_sources.copyright_status`는 **이미 채워져 있고(93.6%가 `embeddable`),
이미 상세 쿼리가 통째로 읽어 오고 있는데(`meme_sources(*)`), 화면 어디에도 쓰이지
않는다** — 소스 전체에서 `copyright_status`를 참조하는 곳은 `scripts/quality-check.mts`
테스트와 관리자 액션(`lib/actions/admin-sources.ts:184`)뿐이다(grep 확인, 사용자
화면 0곳). "권리 노출 방식"은 새 파이프라인을 기다릴 필요 없이 **지금 있는 필드를
꺼내 쓰기만 하면 된다** — 이번 설계에서 유일하게 새 로직이 필요한 항목이다.

---

## 2. 기존 3개 컴포넌트 — 역할과 처리 방안

| 컴포넌트 | 지금 하는 일 | 이 설계에서 |
| --- | --- | --- |
| `components/trust-note.tsx` | 근거 0/맥락만/원본 있음 3단계 요약 한 줄. `#meme-about` 안, 정보계층 6번 자리에 이미 있음(`app/(default)/memes/[key]/page.tsx:386-393`) | **그대로 둔다.** 위치도 로직도 안 건드림. 패널의 접힌 트리거 옆에 놓여 "왜?"를 누르면 패널이 펼쳐지는 구조 — TrustNote가 이미 계산한 `summarizeEvidence()` 결과를 패널이 **재계산 없이 재사용**한다 |
| `components/source-evidence.tsx` | 서지 정보 있는 출처 전체 목록(`#source-evidence-title`) | **그대로 둔다.** 패널은 목록을 다시 그리지 않고 `href="#source-evidence-title"` 앵커 링크로 위임한다 — 근거 20건짜리 문서에서 접힌 패널 안에 또 20줄이 생기는 걸 막는다 |
| `components/doc-status-note.tsx` | "무엇이 비었는지" 상세 설명(`#doc-status-title`), 얇은 문서에만 렌더 | **그대로 둔다.** 패널의 "문서 상태" 항목은 배지 하나(검수 완료/출처 확인 중 + 보강 중)만 찍고, 얇은 문서면 `href="#doc-status-title"`로 위임 — trust-note.tsx:17-18의 기존 원칙("충실도는 DocStatusNote가 이미 말하므로 반복하지 않는다")을 패널에도 그대로 적용 |

**왜 흡수(merge)하지 않았나.** 셋 다 각각 다른 실패 모드를 막으려고 만들어진
컴포넌트다 — TrustNote는 "무근거 문서의 검수 완료 주장"(DQ-001), DocStatusNote는
"조사 placeholder 노출"(DES-003), SourceEvidence는 "URL을 근거로 지어내기" 방지.
하나로 합치면 세 실패 모드를 한 컴포넌트가 동시에 책임지게 되고, 지금 10건의
회귀 테스트가 그 경계에 정확히 걸려 있다(trust-note.test.tsx 7 + doc-status-note.test.tsx 3).
합치는 순간 이 테스트들을 다시 설계해야 하는데, LOOP.md 절대규칙 12("변경하지 않은
영역을 임의로 정리·리팩터링하지 않는다")에 정면으로 걸린다. **위임형 신설이 더
작은 diff이고 더 안전하다.**

---

## 3. 컴포넌트 구조 (JSX 스케치)

신규 파일 1개만 제안한다: `components/trust-panel.tsx` (기존 3개와 같은 위치,
같은 파일 크기대). `page.tsx:393` (`<TrustNote .../>` 닫는 태그) 바로 아래에 형제로
추가하는 것을 가정한다 — 실제 삽입은 이 설계의 범위 밖(소스 미수정).

```tsx
// components/trust-panel.tsx (신규 — 이 설계안의 유일한 신규 파일)
"use client";

import { useId, useState } from "react";
import { summarizeEvidence, type EvidenceSourceInput } from "@/lib/source-links";
import { contentDepth, type ContentDepthInput } from "@/lib/content-depth";
import { MODERATION_STATUS } from "@/lib/labels"; // ⚠️ approved.user 라벨 추가 필요 — §6

/** 권리 노출 방식 집계. lib/source-links.ts의 summarizeEvidence()와 같은 자리에
 *  두는 걸 제안(같은 입력 소스, 같은 "URL 중복 제거" 원칙 공유). 신규 함수 1개. */
type RightsSourceInput = { source_url?: string | null; copyright_status?: string | null };
// export function summarizeRights(sources: RightsSourceInput[]): {
//   embeddable: number; needsPermission: number; internalOnly: number; unknown: number;
// } — URL 기준 중복 제거 후 copyright_status별로 센다. 신규 enum 값
//   (permission_needed/internal_only)은 현재 데이터에 0건이지만 enum엔 존재하므로 분기만 준비.

type TrustPanelProps = {
  meme: ContentDepthInput & {
    title: string;
    moderation_status: "approved" | "limited";
    updated_at: string;
    created_at: string;
  };
  sources: (EvidenceSourceInput & RightsSourceInput)[]; // meme.meme_sources 그대로 전달
};

export function TrustPanel({ meme, sources }: TrustPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const evidence = summarizeEvidence(sources);        // 기존 함수 재사용 — TrustNote와 동일 입력
  const depth = contentDepth(meme);                    // 기존 함수 재사용 — DocStatusNote와 동일 입력
  // const rights = summarizeRights(sources);           // 신규 함수(§1 근거)

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-foreground underline underline-offset-2"
      >
        <span aria-hidden>{open ? "▾" : "▸"}</span>
        이 설명을 믿을 수 있는 이유
      </button>

      {open && (
        <dl id={panelId} className="mt-3 space-y-3 text-sm">
          {/* 1. 마지막 검수일 — TrustNote와 같은 값(meme.updated_at)을 다시 포맷.
                단일 날짜라 링크 위임 없이 그대로 반복해도 중복 프로즈가 아니다. */}
          <PanelRow label="마지막 검수일">
            <time dateTime={meme.updated_at}>{formatKoDate(meme.updated_at)}</time>
          </PanelRow>

          {/* 2. 문서 상태 — moderation_status(공개 문서는 approved|limited만) +
                contentDepth().isThin 배지. 프로즈는 없음, DocStatusNote로 위임. */}
          <PanelRow label="문서 상태">
            <StatusBadges status={meme.moderation_status} isThin={depth.isThin} />
          </PanelRow>

          {/* 3+4. 근거 출처 수·역할 + 원본 확인 여부 — 같은 EvidenceSummary에서
                파생되는 한 묶음이라 한 항목으로 합쳐 보여준다(중복 계산 없음). */}
          <PanelRow label="근거 출처">
            <EvidenceBreakdown evidence={evidence} />
            {evidence.total > 0 && (
              <a href="#source-evidence-title" className="mt-1 inline-block underline underline-offset-2">
                근거 자료 전체 보기
              </a>
            )}
          </PanelRow>

          {/* 5. 권리 노출 방식 — meme_sources.copyright_status 집계. 이 설계의
                유일한 신규 데이터 사용처(§1). */}
          <PanelRow label="권리 노출 방식">
            <RightsSummary sources={sources} />
          </PanelRow>

          {/* 6. 수정 이력 요약 — meme_revisions는 anon 키로 0행(§1). 실물 이력은
                못 보여준다. 정직한 대체: created_at→updated_at 2점 요약만. */}
          <PanelRow label="수정 이력">
            <RevisionSummary createdAt={meme.created_at} updatedAt={meme.updated_at} />
          </PanelRow>

          {/* 7. 오류 제보 CTA — TrustNote/DocStatusNote와 동일한 href 패턴 재사용 */}
          <a
            href={`/submit?name=${encodeURIComponent(meme.title)}`}
            className="mt-1 inline-flex min-h-11 items-center rounded-xl bg-surface-2 px-4 py-2.5 font-semibold underline underline-offset-2"
          >
            이 문서에 오류를 발견했어요
          </a>
        </dl>
      )}
    </div>
  );
}
```

`PanelRow`/`StatusBadges`/`EvidenceBreakdown`/`RightsSummary`/`RevisionSummary`는
같은 파일 안의 작은 내부 함수(파일 400줄 넘지 않는 한 분리 안 함 — YAGNI, 재사용처가
지금은 이 패널 하나뿐이라 별도 export 안 만듦). `formatKoDate`는
`TrustNote`의 인라인 `toLocaleDateString` 호출과 동일한 포맷 — 여기서도 그대로
inline, 별도 `lib/format.ts` 신설은 두 호출뿐이라 과함(YAGNI).

**"use client"가 필요한 이유는 `useState` 하나뿐이다.** 나머지 계산(`summarizeEvidence`,
`contentDepth`, 라벨 조립)은 전부 순수 함수라 서버에서 돌려도 되지만, 컴포넌트를
쪼개 서버 계산 + 클라이언트 토글로 나누면 파일이 2개가 되고 props가 한 번 더
직렬화된다. 지금 페이지에 이미 `Comments`(`ReportButton`, `components/comments.tsx:209-245`)가
같은 패턴(단일 파일, `"use client"`, 토글 하나)으로 존재해 — 그 전례를 그대로 따른다.

---

## 4. 상태별 문구

각 항목은 서로 독립적인 축이라 표로 나열한다(곱집합 매트릭스가 아니라 축마다
가능한 값 전부).

**문서 상태** (`moderation_status` × `isThin`, 공개 문서는 항상 approved 또는 limited)

| moderation_status | isThin | 배지 문구 |
| --- | --- | --- |
| approved | false | `확인 완료` |
| approved | true | `확인 완료 · 보강 중` |
| limited | false | `출처 확인 중` |
| limited | true | `출처 확인 중 · 보강 중` |

`보강 중`이 붙으면 배지 아래 한 줄만 추가: `무엇이 비었는지는 아래에서 확인하세요`
+ `#doc-status-title` 앵커. 문장을 새로 안 쓴다 — DocStatusNote:38-47이 이미 구체적
결손 항목(유래/사용 예문/출처)을 말하고 있어 여기서 반복하면 정확히 trust-note.tsx:17
코멘트가 경고한 "같은 사실을 두 번 쓰면 둘 다 배경이 된다"가 재발한다.

**근거 출처 (EvidenceBreakdown)** — `summarizeEvidence()`가 이미 계산하는
`{total, primary, context, identifiedPrimary}` 그대로, 문장만 신설:

| 조건 | 문구 |
| --- | --- |
| `total === 0` | `아직 연결된 출처가 없어요` |
| `identifiedPrimary > 0` | `원본·보도 {identifiedPrimary}개 확인` (+ `context > 0`이면 `· 맥락 자료 {context}개`) |
| `identifiedPrimary === 0 && primary > 0` | `출처 링크 {primary}개 — 서지 정보 확인 중` |
| `identifiedPrimary === 0 && primary === 0 && context > 0` | `맥락 자료 {context}개만 확인 — 원본은 못 찾음` |

이 네 갈래는 `TrustNote`의 기존 3분기(0/맥락만/원본)와 정확히 같은 신호에서
나온다 — "원본 확인 여부"를 별도 항목으로 안 만들고 이 표 안에 흡수한 이유다.
따로 "예/아니오" 배지를 하나 더 만들면 같은 숫자(`identifiedPrimary`)를 두 가지
다른 말로 두 번 보여주게 된다.

**권리 노출 방식 (RightsSummary)** — `copyright_status` enum 4값 중 실측 2값만
프로덕션에 존재(§1). 없는 값은 문구를 준비만 해 두고 지금은 안 나온다(0건이면
그 줄 자체를 렌더하지 않음 — SourceEvidence의 "실을 게 없으면 섹션 자체를
렌더하지 않는다" 원칙과 동일):

| copyright_status | 문구 | 실측 비중 |
| --- | --- | --- |
| `embeddable` | `임베드 권리 확인됨 {n}건` | 93.6% |
| `unknown` | `권리 확인 필요 {n}건` | 6.4% |
| `permission_needed` | `권리자 허가 필요 {n}건` | 0건(enum만 존재) |
| `internal_only` | `직접 노출 제한 {n}건` | 0건(enum만 존재) |

`unknown`이 있으면 "직접 노출은 안 하지만 원문 링크로만 연결" 같은 부연은 넣지
않는다 — 검증 안 된 정책 설명을 지어내는 셈이라 LOOP.md 절대규칙 4("AI가 만든 …
자동 공개 금지")와 같은 결의 문제. 숫자만 정직하게 말한다.

**수정 이력 (RevisionSummary)** — `meme_revisions` 없이 `created_at`/`updated_at`
2점만으로:

| 조건(초 단위 비교) | 문구 |
| --- | --- |
| `updated_at - created_at < 60초` | `등록 이후 수정 이력 없음` |
| 그 외 | `등록 {created_at} 이후 {updated_at}에 수정됨` |

**세부 변경 내역(무엇이 바뀌었는지, 누가 바꿨는지)은 이 패널이 만들지 않는다.**
`meme_revisions`가 운영자 전용 RLS인 이상(§1) 이보다 자세한 이력은 스키마 경계
밖이다. 공개하려면 (a) RLS 정책 완화 또는 뷰 신설, (b) `editor_id` 등 개인정보
컬럼 노출 여부 검토가 먼저 필요하다 — 둘 다 LOOP.md HUMAN_GATE 대상("편집 원칙
변경"에 준함)이라 이 설계에서 결정하지 않는다. `DECISIONS.md` HG 목록에 신규
항목으로 올리는 걸 제안하되, 그 파일도 이번 루프의 쓰기 대상이 아니라 여기 각주로만
남긴다.

**DQI 숫자는 어디에도 없다.** 패널의 다섯 항목(마지막 검수일/문서 상태/근거·역할/
권리/수정 이력)은 전부 원본 필드값(날짜, enum, 카운트)이거나 `contentDepth().isThin`
같은 불리언이다. `contentDepth().score`(0~13점, 내부 DQI 자리를 차지하는 값 —
`docs/renewal/DECISIONS.md` D-001)는 패널 어디에도 바인딩하지 않는다.

---

## 5. 접기/펼치기 접근성

기존 코드베이스에 두 전례가 있다 — `<details className="group" open>`
(`components/site-footer.tsx:70`, 모바일/데스크톱 이중 렌더용) vs `useState` +
버튼 `aria-expanded`(`components/comments.tsx:209-245`, 단일 토글). 이 패널은
**후자를 따른다** — 이유: `<details>`는 열림 상태가 항상 브라우저 기본 삼각형
마커로만 표시돼 디자인 토큰(`▸`/`▾`)을 못 쓰고, `site-footer.tsx`의 용례는 "항상
열려 있는데 반응형으로 렌더 방식만 바꾸는" 다른 문제라 지금 필요("기본 닫힘,
누르면 펼침")와 안 맞는다. `comments.tsx`의 `ReportButton`이 이미 정확히 같은
요구(기본 닫힘 단일 토글)를 겪었고 테스트 없이도 잘 동작 중이라 그 패턴을 그대로
복붙 수준으로 따른다.

- 트리거는 `<button type="button">`(링크 아님 — 네비게이션이 아니라 상태 토글).
- `aria-expanded={open}` — 스크린리더가 펼침/접힘을 즉시 안다.
- `aria-controls={panelId}` — `useId()`로 발급, 패널 `id`와 연결(`ReportButton`엔
  없던 것을 추가 제안 — WCAG 4.1.2 최소 요건에 더 가깝고 비용이 0에 가깝다).
- 패널 콘텐츠는 `open && (...)`로 **DOM에서 제거**한다(CSS `display:none`이 아니라
  조건부 렌더). 이유: `SourceEvidence`/`DocStatusNote` 앵커로 점프하는 링크가
  패널 밖에 있어, 패널이 닫혀 있어도 그 링크들 자체는 항상 도달 가능해야 하고
  패널 내부의 중복 포커스 정지점이 접힌 상태에서 tab 순서에 끼면 안 된다.
- 트리거 텍스트 자체가 라벨이다 — "이 설명을 믿을 수 있는 이유"라는 문구가 이미
  버튼의 accessible name이라 별도 `aria-label` 불필요.
- 최소 터치 타깃 `min-h-11`(44px) — 코드베이스 전역 컨벤션(`TrustNote`·
  `DocStatusNote`의 CTA 링크가 전부 이 클래스를 쓴다) 그대로 재사용.
- 아이콘(`▸`/`▾`)은 `aria-hidden` — 상태는 텍스트(`aria-expanded`)와 버튼
  라벨만으로 전달되고 아이콘은 장식(LOOP.md 절대규칙 8, "색상만으로 상태를
  전달하지 않는다"와 같은 원칙의 아이콘판).
- `prefers-reduced-motion`: 펼침에 transition을 추가한다면 `motion-reduce:transition-none`만
  얹는다(현재 다른 아코디언류 컴포넌트에 애니메이션이 없어 기본값은 즉시 펼침 —
  없는 걸 만들 필요는 없다, YAGNI).
- Focus order: 트리거 → (열림 시) 패널 내부 링크/버튼들이 시각 순서와 DOM 순서가
  일치 — `dl`/`div` 안에 순서대로 배치하고 `tabIndex` 조작 없음.

---

## 6. 이 설계가 요구하는 것 (구현 시 필요, 지금 안 만듦)

1. **`lib/source-links.ts`에 `summarizeRights()` 함수 1개 추가** — §3 스케치의
   시그니처. `summarizeEvidence()` 바로 옆에 두는 걸 제안(같은 입력·같은 원칙).
2. **`lib/labels.ts:28`에 `approved.user` 라벨 추가** — 지금은
   `approved: { admin: "게시됨", token: "mod-approved" }`로 `user` 키가 아예
   없다(코멘트: "사용자에겐 '출처 확인 중'(limited)만 보임"). 이 패널이 "문서
   상태"에 approved를 노출하는 첫 사용자 화면이라 라벨이 필요하다. 제안값
   `"확인 완료"` — `게시됨`/`승인`처럼 인증을 과장하는 단어를 피하고, `limited`의
   기존 라벨(`출처 확인 중`)과 같은 톤(과정형·서술형)을 맞췄다.
3. **`components/trust-panel.tsx` 신규 파일** — §3 그대로.
4. **`page.tsx` 삽입 지점** — `TrustNote` 닫는 태그(현재 393행) 직후, 같은
   `#meme-about` 섹션 안. 정보계층 6번 자리를 벗어나지 않는다.

이 넷은 **다음 루프의 구현 대상**이며 이번 루프에서는 만들지 않았다(과업 지시:
소스 수정 금지, 산출물 파일 하나만).

---

## 7. 처리하지 않은 것 (의도적 제외)

- **`meme_media.source_role` 기반 "출처 역할" 표시** — §1에서 확인했듯 anon
  키로 0행. 정책을 안 바꾸면 영구히 후보가 아니다. "역할"은 대신 `summarizeEvidence()`가
  이미 구분하는 원본/맥락 축으로 대체했다(§4 표) — 이름은 같아도 데이터 출처는
  완전히 다르다는 점을 분명히 남긴다.
- **`meme_revisions` 기반 실제 변경 로그(무엇을, 누가)** — RLS로 봉쇄. `created_at`/
  `updated_at` 2점 요약이 이 설계의 한계이자 정직한 대체안(§4).
- **DQI 점수 노출·시각화(게이지, 퍼센트, 등급 배지)** — 과업 지시로 금지. `contentDepth().score`는
  내부 색인 판정에만 남는다.
- **곱집합 상태 매트릭스 사전 렌더(가능한 조합을 표로 다 그려두기)** — 각 항목이
  독립 축이라 조합 폭발이 없다. 굳이 안 만든다(YAGNI).
- **범용 `<Disclosure>` 컴포넌트 추출** — 지금 사용처가 이 패널 하나뿐이라
  `site-footer.tsx`의 `<details>`까지 통합하는 리팩터링은 요청 범위 밖이고
  절대규칙 12 위반이다.
