# 신뢰 패널 설계 — minimal-diff 관점 (loop-024)

> 이 문서는 설계안이다. 소스는 수정하지 않았다. 코드 스케치는 구현 참고용 의사코드다.

---

## 0. 결론 요약

- **대체 아님, 흡수(absorb).** `TrustNote`·`DocStatusNote`는 **그대로 둔다**(0줄 변경).
  `SourceEvidence`는 파일은 그대로 두고 **렌더 위치만** 새 `TrustPanel` 안으로 옮긴다.
- 신규 파일 1개(`components/trust-panel.tsx`, 서버 컴포넌트, 클라이언트 JS 0)
  + `page.tsx`에서 `<SourceEvidence>` 호출 위치를 옮기고 `<TrustPanel>` 1곳 추가.
- 접기/펼치기는 `explore-filters.tsx`식 `useState` 버튼이 아니라 **네이티브
  `<details>/<summary>`**를 쓴다 — 이 저장소에 이미 선례가 있다
  (`components/site-footer.tsx:70-78`). `aria-expanded`를 손으로 달지 않아도
  `<summary>`의 암묵적 ARIA role=button이 열림 상태를 자동으로 노출한다.
- `근거 출처 역할`은 `meme_media.source_role`을 쓰지 않는다. **프로덕션에서 anon
  키로 `meme_media`를 GET하면 빈 배열이 온다 — 공개 화면에서 읽을 수 있는 테이블이
  아니다**(운영자 전용 RLS, 아래 §1 실측). 대신 이미 공개 읽기가 열려 있고 페이지가
  이미 로드해 둔 `meme_sources`에서 `lib/source-links.ts`의 `summarizeEvidence()`가
  구분하는 원본·보도 vs 맥락 위키 축을 그대로 재사용한다.
- `권리 노출 방식`은 `meme_sources.copyright_status`(공개 읽기, 이미 select에 포함됨,
  쿼리 변경 0)로 표시하되, "확인 완료"류 단정 문구를 쓰지 않는다 — 실측 결과
  `embeddable`은 저작권 검증이 아니라 관리자가 임베드를 게시했는지의 이분값이다(§1).
- `수정 이력`은 `meme_revisions`를 못 읽으므로(운영자 전용 RLS, §1) 항목별 변경
  목록을 지어내지 않는다. `updated_at` 기반의 정직한 한 줄 + "아직 공개하지 않음"
  캡션으로 대체하고, 진짜 이력 노출은 기존 `DQ-010`/`HG` 의존성 그대로 둔다.

---

## 1. 데이터 현실 — 실측 (프로덕션, anon 키, GET만)

```
$ curl -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
    ".../rest/v1/meme_media?limit=1"          → []
$ curl ... ".../rest/v1/media_sources?limit=1" → []
$ curl ... ".../rest/v1/meme_revisions?limit=1" → []
```

세 테이블 모두 anon 키로는 **빈 배열**. 마이그레이션과 일치한다.

| 테이블 | RLS | 근거 |
| --- | --- | --- |
| `meme_media` | 운영자 전용(`for all using (is_operator())`) | `supabase/migrations/20260723120000_source_pipeline.sql:153-155` |
| `media_sources` | 운영자 전용 | `supabase/migrations/20260723120000_source_pipeline.sql:150-152` |
| `meme_claims` | 운영자 전용 | `supabase/migrations/20260723120000_source_pipeline.sql:156-158` |
| `meme_revisions` | 운영자 또는 `editor_id = auth.uid()` | `supabase/migrations/20260708004500_schema_v2.sql:520,553,569` |
| `meme_sources` | **공개 읽기** — 소속 밈이 `approved`/`limited`면 누구나 | `supabase/migrations/20260708004500_schema_v2.sql:526-527` |

**결론:** LOOP.md가 예시로 든 `source_role`은 스키마상 `meme_media`에만 있고, 그
테이블 자체가 공개 화면에서 원천적으로 안 읽힌다. "값이 전부 `usage_example`이라
단조롭다"는 기존 backlog(`DQ-010`, `BACKLOG.md:232`)의 서술보다 한 단계 더
근본적인 제약이다 — 값이 단조로운 게 아니라 **애초에 공개 쿼리로 못 가져온다.**
신뢰 패널이 `meme_media`를 직접 참조하는 설계는 이 사실 하나로 실격이다.

`meme_sources.copyright_status` 실측(공개 읽기, 페이지네이션 전수 조회):

```
총 4,608행
embeddable: 4,315 (93.6%)
unknown:     293  (6.4%)
permission_needed: 0
internal_only:     0
```

이 값의 **실제 의미**는 저작권 검증 결과가 아니라 관리자 액션의 부산물이다.

```ts
// lib/actions/admin-sources.ts:184
copyright_status: linkOnly ? "unknown" : "embeddable",
```

`embeddable`은 "이 출처에 공식 임베드를 게시했다"는 뜻이고 `unknown`은 대부분
"의도적으로 링크만 걸었다"(나무위키 253건·인스타 5건 = unknown 293건 중 88%,
`artifacts/renewal/loop-023/unknown-copyright-domains.md:12-15,70-71`)는 뜻이지
"아직 확인 안 함"이 아니다. 그래서 패널 문구는 **"저작권 확인 완료"류 법적 단정을
쓰지 않고** "공식 임베드로 게시"/"링크로만 연결"처럼 **관찰 가능한 사실**로만 쓴다.

부수 관찰(범위 밖, 참고만): `sources_public_read` 정책은 `copyright_status`로
필터링하지 않는다(`schema_v2.sql:526-527`). `internal_only`(현재 0건)가 언젠가
쓰이면 이름과 달리 공개 GET에 그대로 노출된다. 이번 설계로 고치지 않는다 — 별도
DQ 후보로만 남긴다.

---

## 2. 기존 3개 컴포넌트 처리 방안 — 대체 아님, 흡수

| 컴포넌트 | 처리 | 이유 |
| --- | --- | --- |
| `components/trust-note.tsx` | **유지, 0줄 변경** | LOOP.md 상세 정보 계층 6번("마지막 검수일 + 근거 출처 수 + 문서 완성 상태")을 이미 첫 화면 근처에서 압축 한 줄로 충족한다. 패널을 접어 두면 이 요약까지 숨어 정보 계층 순서를 어긴다. |
| `components/doc-status-note.tsx` | **유지, 0줄 변경** | LOOP.md §4 "불완전 경고가 본문보다 시각적으로 더 커져 핵심 뜻을 가리지 않도록"은 배너를 작게 만들라는 말이지 접어서 숨기라는 말이 아니다. 지금 위치(정답 카드 직후, 최상단)가 이미 눈에 띄는 자리이고 루프 005가 조사 placeholder 회귀까지 테스트로 막아 둔 컴포넌트다. 패널 안에 다시 넣으면 기본 접힘 상태에서 오히려 덜 보이게 된다. |
| `components/source-evidence.tsx` | **흡수 — 파일 불변, 호출 위치만 이동** | 이 컴포넌트가 실제로 LOOP.md 신뢰 패널이 말하는 "근거 출처를 펼쳐 보여주는" 딥다이브 콘텐츠 그 자체다. 지금은 상시 펼침 top-level `<section>`이라 출처가 많은 문서에서 본문(§2 정보 계층 6·7·8번)을 아래로 밀어낸다. 패널 안 `<details>` 본문으로 옮기면 컴포넌트 코드는 안 건드리면서 "핵심 정보 먼저, 근거 상세는 opt-in"이 된다. `<details>` 닫힘 상태도 DOM에는 남아 있어(브라우저가 `display:none`으로만 감춤) 색인 콘텐츠가 사라지지 않는다. |

**중복이 실제로 있던 지점은 하나뿐이다:** LOOP.md는 "출처 역할"·"권리 노출 방식"·
"수정 이력"을 요구하는데 이 셋 중 어느 기존 컴포넌트도 담당하지 않는다. 새로
만드는 `TrustPanel`은 이 **빈 세 칸만** 계산하고, 이미 있는 근거 카운트는
`summarizeEvidence()`를 그대로 import해 재사용한다(숫자를 두 곳에서 따로
계산하면 어긋날 수 있으므로 — D-001과 같은 원칙).

---

## 3. 컴포넌트 구조 — JSX 스케치

```tsx
// components/trust-panel.tsx (신규, 서버 컴포넌트 — "use client" 불필요)
import Link from "next/link";
import { SourceEvidence } from "@/components/source-evidence";
import {
  summarizeEvidence,
  type EvidenceSourceInput,
  type CitableSourceInput,
} from "@/lib/source-links";
import { contentDepth, type ContentDepthInput } from "@/lib/content-depth";
import { MODERATION_STATUS } from "@/lib/labels";

type CopyrightStatus = "unknown" | "embeddable" | "permission_needed" | "internal_only";

type TrustPanelSource = EvidenceSourceInput &
  CitableSourceInput & { copyright_status?: CopyrightStatus | null };

export function TrustPanel({
  meme,
  sources,
  title,
  updatedAt,
  moderationStatus,
}: {
  meme: ContentDepthInput;
  sources: TrustPanelSource[];
  title: string;
  updatedAt: string;
  moderationStatus: "approved" | "limited"; // 공개 문서는 이 두 값만 온다(PUBLIC_STATUSES)
}) {
  const evidence = summarizeEvidence(sources);
  const depth = contentDepth(meme);
  const docStatus = describeDocStatus(moderationStatus, depth.isThin);
  const rights = describeRights(sources);
  const updated = formatKoreanDate(updatedAt);

  return (
    <details className="group rounded-2xl border border-border bg-surface p-5">
      <summary
        className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-base font-bold [&::-webkit-details-marker]:hidden"
      >
        이 설명을 믿을 수 있는 이유
        <span aria-hidden className="text-muted transition-transform duration-200 group-open:rotate-180">
          ⌄
        </span>
      </summary>

      <dl className="mt-3 divide-y divide-border text-sm">
        <PanelRow term="문서 상태" detail={docStatus} />
        <PanelRow term="마지막 검수일" detail={<time dateTime={updatedAt}>{updated}</time>} />
        <PanelRow term="근거 출처" detail={describeEvidenceCount(evidence)} />
        <PanelRow term="원본 확인" detail={describeOriginalConfirmed(evidence)} />
        <PanelRow term="권리 노출 방식" detail={rights} />
        <PanelRow
          term="수정 이력"
          detail={`최근 변경 ${updated} 업데이트 · 항목별 변경 이력은 아직 공개하지 않아요`}
        />
      </dl>

      {/* 기존 컴포넌트를 그대로 재사용 — 로직·문구 변경 없음 */}
      <div className="mt-4 border-t border-border pt-4">
        <SourceEvidence sources={sources} />
      </div>

      <Link
        href={`/submit?name=${encodeURIComponent(title)}`}
        className="mt-4 inline-flex min-h-11 items-center underline underline-offset-2 transition-colors hover:text-foreground"
      >
        이 설명에 잘못된 부분이 있나요? 알려 주세요
      </Link>
    </details>
  );
}

function PanelRow({ term, detail }: { term: string; detail: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:gap-3">
      <dt className="w-32 shrink-0 font-medium text-muted">{term}</dt>
      <dd>{detail}</dd>
    </div>
  );
}
```

`page.tsx` 쪽 변경(스케치, 실제 diff는 다음 구현 루프):

```diff
- <SourceEvidence sources={meme.meme_sources} />
+ <TrustPanel
+   meme={meme}
+   sources={meme.meme_sources}
+   title={meme.title}
+   updatedAt={meme.updated_at}
+   moderationStatus={meme.moderation_status}
+ />
```

`TrustNote`·`DocStatusNote` 호출부(`page.tsx:307`, `:388-393`)는 **그대로 둔다.**

---

## 4. 상태별 문구

### 4.1 문서 상태 (3종 — LOOP.md 문구를 그대로 쓰지 않고 기존 단일 출처를 재사용)

`lib/labels.ts:23-29`에 이미 `MODERATION_STATUS`가 있고, 주석이 명시한다:
`"검수 상태 — 관리자 전용 노출. 사용자에겐 '출처 확인 중'(limited)만 보임"`.
LOOP.md 원문은 "제한 공개"라는 단어를 쓰지만, 그 단어는 **이 저장소에서 이미
관리자 전용으로 확정돼 있다**(`admin/constants.tsx:32`, `/editorial` 본문에도
"제한 공개"는 괄호 병기로만 등장, 사용자 문구는 "출처 확인 중"). 신뢰 패널이
LOOP.md 원문을 그대로 베껴 "제한 공개"를 새로 노출하면, 같은 상태를 가리키는
사용자용 단어가 화면 두 곳에서 달라진다. **`MODERATION_STATUS.limited.user`를
그대로 import해 재사용한다** — 새 단어를 만들지 않는다.

우선순위: `limited` > `보강 중`(얇음) > `검수 완료`. 공개 문서는 항상
`approved`/`limited`만 오므로(`lib/queries.ts:58,69` `PUBLIC_STATUSES`) 3분기로
충분하다.

| 조건 | 표시 |
| --- | --- |
| `moderation_status === "limited"` | **출처 확인 중** (기존 `MODERATION_STATUS.limited.user` 재사용) |
| `approved` & `contentDepth(meme).isThin` | **보강 중** — 바로 위 `DocStatusNote`가 이미 사유를 구체적으로 말하고 있으므로 여기서는 라벨만, 문장을 반복하지 않는다 |
| `approved` & 얇지 않음 | **검수 완료** |

### 4.2 근거 출처 수와 역할 — `summarizeEvidence()` 재사용, 새 계산 없음

| `evidence` 값 | 표시 |
| --- | --- |
| `total === 0` | 아직 없음 |
| `context > 0 && primary === 0` | `{context}개 (전부 맥락 확인용 위키)` |
| `primary > 0` | `{total}개 (원본·보도 {primary} · 맥락 {context})` — `context === 0`이면 뒷부분 생략 |

`TrustNote`가 같은 필드로 이미 압축 문장을 만들고 있으므로(§2) 여기서는 숫자
문장을 반복하되 "역할"(원본·보도 vs 맥락) 축을 함께 밝혀 LOOP.md가 요구하는
분해 정보를 추가한다. 계산 로직은 하나(`summarizeEvidence`)뿐이라 두 표시가
어긋날 일이 없다.

### 4.3 원본 확인 여부

| 조건 | 표시 |
| --- | --- |
| `evidence.identifiedPrimary > 0` | 예 — 서지(제목·작성자)가 확인된 원본·보도가 있어요 |
| `evidence.primary > 0 && evidence.identifiedPrimary === 0` | 아니오 — 원본 링크는 있지만 서지 확인 전이에요 |
| `evidence.primary === 0` | 아니오 — 원본은 아직 찾지 못했어요 |

### 4.4 권리 노출 방식 (`copyright_status` 집계, §1 근거)

법적 단정을 피하고 관찰 사실만 말한다. `permission_needed`/`internal_only`는
현재 0건이지만 enum에 있으므로 방어적으로 문구를 만들어 둔다(값이 생겨도
런타임 에러 없이 의미 있는 문구가 나오도록).

| 이 문서 출처들의 `copyright_status` 집합 | 표시 |
| --- | --- |
| 비어 있음 | 연결된 출처가 없어 권리 정보도 없어요 |
| `permission_needed` 포함 | 일부 자료는 권리자 허가를 기다리고 있어요 |
| `internal_only` 포함 | 일부 자료는 외부에 공개하지 않고 있어요 |
| `embeddable`만 | 공식 임베드로 게시했어요 |
| `embeddable` + `unknown` 혼합 | 일부는 공식 임베드로 게시, 나머지는 링크로만 연결했어요 |
| `unknown`만 | 링크로만 연결했어요 — 별도 임베드 권리는 확인하지 않았어요 |

### 4.5 수정 이력 요약

`meme_revisions`를 못 읽으므로(§1) 항목 단위 변경 로그를 지어내지 않는다.

```
최근 변경 {updated_at 날짜} 업데이트 · 항목별 변경 이력은 아직 공개하지 않아요
```

진짜 이력 노출은 `DQ-010`이 이미 명시한 선행 조건(`meme_revisions` 공개 노출 전
`editor_id` 등 개인정보 검토) 그대로 남겨 둔다 — 이 설계는 그 게이트를 우회하지
않는다.

### 4.6 오류 제보 CTA

`TrustNote`·`DocStatusNote`와 동일한 기존 패턴 재사용, 새 문구·새 라우트 없음:

```tsx
<Link href={`/submit?name=${encodeURIComponent(title)}`}>
  이 설명에 잘못된 부분이 있나요? 알려 주세요
</Link>
```

---

## 5. 접기/펼치기 접근성

**결정: 네이티브 `<details>`/`<summary>`, 새 클라이언트 컴포넌트·`useState` 없음.**

- 이 저장소에 이미 같은 패턴이 있다 — `components/site-footer.tsx:70-78`
  (`<details className="group" open><summary>...group-open:rotate-180`). 신뢰
  패널은 그 자매 컴포넌트로 만든다.
- `<summary>`의 암묵적 ARIA role은 `button`이고, `aria-expanded`는 부모
  `<details>`의 `open` 속성 유무를 브라우저가 자동으로 반영한다(HTML-AAM 명세).
  손으로 `aria-expanded={open}`을 붙이는 `explore-filters.tsx:288` 패턴은 그
  컴포넌트가 URL query state와 동기화해야 해서 어차피 클라이언트 컴포넌트였기
  때문에 쓴 것이지, 이 패널에는 그 이유가 없다 — 서버 컴포넌트로 남기는 쪽이
  더 작은 diff다(ladder 4번: 네이티브 플랫폼 기능이 이미 커버).
- 기본 상태: **닫힘**(`open` 속성 없음). `TrustNote`가 이미 첫 화면 근처에서
  압축 요약을 주므로, 패널은 딥다이브 opt-in이다. `site-footer.tsx`의 `<details
  open>`은 법적 고지처럼 항상 보여야 하는 내용이라 기본 펼침인 것과 다른 이유다.
  자동 스크린리더 알림 없이도 닫힌 `<details>`의 자식은 DOM에 남아 있어(브라우저가
  `display:none`으로 감출 뿐) 크롤러 색인에는 영향이 없다.
- 키보드: 네이티브 `<summary>`는 Enter/Space로 토글되고 Tab 순서에 자동으로
  들어간다 — 별도 `onKeyDown` 구현이 필요 없다.
- 클릭 타깃: `min-h-11`(44px)로 다른 인터랙션 요소와 동일 기준 적용.
- 마커 숨김: `[&::-webkit-details-marker]:hidden` — `site-footer.tsx`와 동일
  클래스라 새 CSS 규칙이 필요 없다.
- 향후 "패널 열람" 분석 이벤트가 필요해지면(`meme_source_opened`류) 그때
  `onToggle`을 붙이며 클라이언트 컴포넌트로 승격하면 된다 — 지금은 `HG-006`이
  이벤트 확장 자체를 사람 결정 대기로 묶어 두고 있으므로 앞당기지 않는다.

---

## 6. 남는 제약 · 이 설계로 풀지 않는 것

1. **`meme_media.source_role` 공개 노출은 불가능하다(현재 스키마 기준).**
   운영자 전용 RLS를 공개로 여는 것은 LOOP.md 절대규칙과 무관하게 그 자체로
   스키마·정책 변경이라 이 설계(화면 전용, minimal-diff)의 범위 밖이다. 이
   문서는 그 값을 안 쓰는 것으로 우회했을 뿐 RLS를 바꾸자는 제안이 아니다.
2. **`meme_revisions` 공개 노출은 `DQ-010`이 이미 건 게이트(개인정보 검토) 그대로
   남는다.** 이 설계가 추가한 것은 게이트가 풀리기 전에도 정직하게 보여줄 수 있는
   `updated_at` 기반 최소 문구뿐이다.
3. `internal_only`가 `sources_public_read`에서 필터링되지 않는 점(§1)은 이번
   설계로 고치지 않는다 — 별도 항목으로만 남긴다. 현재 실제 값이 0건이라 당장의
   노출 사고는 없다.
4. `<details>` 접힘 콘텐츠가 SEO 점수에 완전히 동등하게 반영되는지는 검증하지
   않았다(색인은 되지만 순위 가중치는 별도 확인 필요) — 필요하면 다음 루프의
   `metadata/canonical 검사` 단계에서 실측한다.

---

## 7. 다음 구현 루프를 위한 변경 파일 목록 (참고용, 이번 루프는 미실행)

| 파일 | 변경 |
| --- | --- |
| `components/trust-panel.tsx` | 신규 |
| `components/trust-panel.test.tsx` | 신규 — §4의 6개 분기(문서상태 3 · 근거 3 · 권리노출 4)를 표 기반 테스트로 |
| `app/(default)/memes/[key]/page.tsx` | `<SourceEvidence>` 호출 삭제 후 `<TrustPanel>` 1곳 추가(§3 diff) |
| `components/trust-note.tsx` | 변경 없음 |
| `components/doc-status-note.tsx` | 변경 없음 |
| `components/source-evidence.tsx` | 변경 없음(호출부만 이동) |

