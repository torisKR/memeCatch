# 신뢰 패널 설계안 — reader-first 관점 (루프 024)

> LOOP.md §3 「이 설명을 믿을 수 있는 이유」. 저장소·프로덕션 데이터를 직접 확인한
> 근거만 쓴다. 소스 미수정 — 이 파일 하나만 산출물이다.

## 0. 결론 (한 줄)

**`TrustNote`는 흡수해 새 `TrustPanel`로 대체하고, `SourceEvidence`·`DocStatusNote`는
그대로 두되 패널이 그 둘을 가리키기만 한다.** 셋을 하나로 합치지 않는다 — 서로
다른 고도(iframe altitude)의 정보라 합치면 패널이 다시 비대해진다.

| 기존 컴포넌트 | 처리 | 이유 |
| --- | :---: | --- |
| `components/trust-note.tsx` | **흡수 후 삭제** | 근거 상태 4분기 로직(`summarizeEvidence` 소비부)이 패널의 접힌 요약줄과 정확히 같은 정보다. 별도 컴포넌트로 남기면 같은 숫자를 두 군데서 계산·렌더하게 된다. |
| `components/source-evidence.tsx` | **유지, 참조만** | "무엇을 근거로 썼나"의 전체 서지 목록은 패널과 다른 일이다(개별 출처 대조 vs 신뢰 상태 요약). 패널 안에 통째로 넣으면 접힌 패널을 펴는 순간 다시 긴 목록이 나와 "빠르게 훑고 넘어간다"는 접기의 목적이 사라진다. |
| `components/doc-status-note.tsx` | **유지, 참조만** | LOOP.md §4(불완전 문서)의 전담 컴포넌트다. 접히면 안 되는 화면이라고 이미 스스로 밝히고 있다(`aside`, 상시 노출). 패널에 흡수하면 가장 눈에 띄어야 할 경고가 접힌 상태 뒤로 숨는다 — reader-first 원칙에 위배. |

---

## 1. 데이터 현실 — 표시 가능한 것과 불가능한 것

프로덕션 anon 키로 직접 확인(`curl -H apikey -H Authorization`, 2026-08-03/04).

| LOOP.md 요구 항목 | 스키마상 후보 | 실측 | 표시 가능? |
| --- | --- | --- | --- |
| 마지막 검수일 | `memes.updated_at`만 존재. `last_verified_at` 없음 | `memes` 테이블 정의: `supabase/migrations/20260708004500_schema_v2.sql:99-101` — `created_at`/`updated_at`/`published_at`뿐 | ⚠️ **부분**. "검수"와 "편집"을 구분하는 컬럼이 없다. `updated_at`을 쓰되 "검수일"이 아니라 "업데이트"로 정직하게 라벨(기존 TrustNote 관례 유지) |
| 문서 상태(검수완료/제한공개/보강중) | `memes.moderation_status` (approved/limited만 공개) + `lib/content-depth.ts`의 `isThin` | `check_moderation_transition()` 트리거가 공개 전이를 approved/limited로만 제한 — `20260708004500_schema_v2.sql:113-133`. `isThin`은 별도 축(아래 §3) | ✅ 두 값의 조합(§3 참조) |
| 근거 출처 수와 역할 | `meme_sources`(공개) vs `meme_media.source_role`(운영자 전용) | `meme_media`는 anon 키로 조회 시 200 + **빈 배열** — RLS `meme_media_operator`가 전체 행을 막는다(`supabase/migrations/20260723120000_source_pipeline.sql:153-155`, 직접 curl 확인). 설사 열려 있어도 `source_role` **6,111건 전부 `usage_example`**(`docs/renewal/BACKLOG.md:232`, `LOOP_STATE.md:384`) — 표시할 값의 분산이 0이다 | ❌ `meme_media.source_role`은 못 쓴다. ✅ 대신 **이미 공개된** `meme_sources`에서 `lib/source-links.ts`가 계산하는 원본·보도(primary) vs 맥락 위키(context) 구분을 "역할"로 재사용 |
| 원본 확인 여부 | `meme_sources.title`/`creator_name` 존재 여부 | 루프 023 전수 확인: `meme_sources` 4,608행 중 **2,876행(62.4%)이 title·creator 둘 다 null**(`components/trust-note.tsx:61-62` 주석, `lib/source-links.ts:87-90`) | ✅ `identifiedPrimary`(서지 있는 원본) vs 맨 URL 구분 이미 계산됨 |
| 권리 노출 방식 | `meme_sources.copyright_status` (enum 4값) | 실측: `embeddable` 4,315 / `unknown` 293 / `permission_needed` 0 / `internal_only` 0 (`meme_sources` 전체 4,608건, PostgREST count) | ✅ 다만 **실사용 값은 2개뿐**이라 6값 taxonomy(LOOP.md의 `rights_basis`)를 그대로 노출하면 없는 값까지 있는 것처럼 보인다 — 2값 기준으로 문구 설계 |
| 수정 이력 요약 | `meme_revisions` (운영자 전용) | anon 키로 조회 시 200 + **빈 배열**. 테이블 정의에 `editor_id uuid references profiles(id)`, `snapshot jsonb`(행 전체 스냅샷), `note text`(내부 사유)가 있음(`20260708004500_schema_v2.sql:290-297`) — RLS를 그냥 풀면 검수자 식별자와 내부 메모가 그대로 공개된다 | ❌ **못 쓴다.** `DQ-010` 완료 조건이 이미 "개인정보(editor_id) 검토 선행"을 명시(`BACKLOG.md:240`). 이 루프 범위 밖 — 아래 §6 |
| 오류 제보 CTA | `/submit?name=` | 기존 `TrustNote`·`DocStatusNote`가 이미 씀. `/submit` 페이지는 `name`/`tiktokImport`/`imported`만 읽는다(`app/(default)/submit/page.tsx:16-19`) — 새 쿼리 파라미터(`reason=` 등)를 붙여도 페이지가 무시하므로 **그대로 재사용** | ✅ |

**DQI 숫자는 어디에도 없다** — 위 표의 모든 문구는 원본 필드값이나 파생 불리언에서 나온다.

---

## 2. 근거 출처 수와 "역할" — 무엇을 재사용하나

`meme_media.source_role`을 못 쓰는 대신, 지금도 상세 페이지가 매 요청마다 계산하는
`lib/source-links.ts`의 `summarizeEvidence()` 출력을 그대로 "역할" 표시에 쓴다.
새 함수를 만들지 않는다(이미 있음, 이미 두 컴포넌트가 검증된 로직으로 소비 중).

```ts
// lib/source-links.ts — 이미 존재, 그대로 재사용
type EvidenceSummary = {
  total: number;            // URL 중복 제거한 근거 수
  primary: number;          // 원본·보도(위키 아님)
  context: number;          // 나무위키·위키백과(맥락 확인용)
  identifiedPrimary: number;// primary 중 title/creator_name 있는 것
};
```

"역할"은 4개의 `source_role` 열거값이 아니라 **원본·보도 계열 / 맥락 위키**라는
2분류로 말한다. 실제로 구분 가능한 유일한 축이기 때문이다.

---

## 3. 문서 상태 판정 — 두 축을 하나의 칩으로

`moderation_status`(편집 게이트)와 `isThin`(콘텐츠 충실도, `lib/content-depth.ts`)은
서로 다른 메커니즘이 독립적으로 계산한다. 실측으로 확인한 조합:

| short_id | moderation_status | isThin(직접 재현) | 근거 출처 | 패널이 보여줄 칩 |
| --- | --- | --- | --- | --- |
| `z4ywt995`(임효준 귀화 논란) | approved | **true**(prose 237자 < 250 하한) | 5개 전부 서지 확인 | `보강 중` |
| `ra86attn`(봉숭아학당 그까이꺼 대충) | approved | false(prose 332자, score 5) | 2개, 전부 맨 URL | `검수 완료` |
| `kecg9kfp`(Boxxy) | **limited** | true(prose 215자, origin이 Wikimedia 상투구라 0으로 처리) | 2개, 맨 URL 위주 | `보강 중` |
| `e8ferq5u`(리부트 서버) | approved | true(prose 170자) | 0개 | `보강 중` |

(계산 방식: `lib/content-depth.ts:161-217`의 임계값을 그대로 손으로 재현. 원본
쿼리·중간값은 이 세션의 curl 로그에 남아 있고, 이 파일에는 결과만 옮긴다.)

`z4ywt995`가 핵심 근거다 — **근거 출처가 5개, 전부 서지 확인까지 끝났는데도
`isThin=true`다.** 근거 수와 문서 충실도는 완전히 다른 축이라는 뜻이다. 그래서
"문서 상태" 칩은 근거 수와 별개로 계산해야 하고, `보강 중`을 감추면 안 된다.

**우선순위 규칙**: `isThin` → `보강 중` (moderation_status와 무관하게 최우선).
그 외엔 `moderation_status`를 그대로 씀 (`approved` → `검수 완료`, `limited` → `제한 공개`).

```ts
function docStateLabel(meme: { moderation_status: "approved" | "limited" }, isThin: boolean) {
  if (isThin) return "보강 중";
  return meme.moderation_status === "limited" ? "제한 공개" : "검수 완료";
}
```

**왜 `isThin`이 이기는가**: `얇음`인데 `검수 완료` 칩을 보여주면, 실제로는 아직
서술이 부족한 문서를 "다 확인됐다"고 단정하는 거짓말이 된다. LOOP.md 절대규칙 5
("독립성·원본성·연관성을 각각 평가")와 정면으로 어긋난다.

**`보강 중` 칩과 `DocStatusNote`는 중복이 아니다** — 칩은 한 단어짜리 존재 신호,
`DocStatusNote`는 "무엇이 왜 부족한지"의 설명이다(같은 사실을 다른 고도에서 말함).
`DocStatusNote`가 이미 위에 렌더돼 있으면 칩 옆에 그 자리로 스크롤하는 링크만
붙인다(문구를 다시 쓰지 않는다).

---

## 4. 컴포넌트 구조 (JSX 스케치)

```tsx
// components/trust-panel.tsx (신규 — trust-note.tsx를 대체)

import Link from "next/link";
import { summarizeEvidence, type EvidenceSourceInput } from "@/lib/source-links";

type TrustPanelProps = {
  sources: EvidenceSourceInput[];       // meme.meme_sources — 이미 fetch됨(변경 없음)
  updatedAt: string;                    // meme.updated_at
  moderationStatus: "approved" | "limited";
  isThin: boolean;                      // contentDepth(meme).isThin — page.tsx에서 이미 계산
  title: string;
  hasDocStatusNote: boolean;            // DocStatusNote가 위에 렌더됐는가(같은 isThin 값)
};

export function TrustPanel({
  sources, updatedAt, moderationStatus, isThin, title, hasDocStatusNote,
}: TrustPanelProps) {
  const evidence = summarizeEvidence(sources);
  const rights = summarizeRights(sources);          // §5 — copyright_status 2값 집계
  const state = docStateLabel({ moderation_status: moderationStatus }, isThin);
  const updated = formatDate(updatedAt);

  return (
    <details className="group rounded-2xl border border-border bg-surface">
      {/* 접힌 상태에서 이미 LOOP.md §2 항목 6(검수일·근거수·문서상태)이 전부 보인다.
          펴야만 보이는 정보는 아래 dl뿐이다. */}
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <StateChip state={state} />
          <span aria-hidden>·</span>
          <span>{evidencePhrase(evidence)}</span>
          <span aria-hidden>·</span>
          <span className="text-muted">
            업데이트 <time dateTime={updatedAt}>{updated}</time>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div className="space-y-3 border-t border-border p-4 text-sm">
        <dl className="space-y-2.5">
          <Row label="근거 출처">
            {evidencePhrase(evidence)}
            {evidence.context > 0 && evidence.primary > 0 && (
              <> — 원본·보도 {evidence.primary}개, 맥락 위키 {evidence.context}개</>
            )}
          </Row>

          <Row label="원본 확인">{originVerificationPhrase(evidence)}</Row>

          <Row label="권리 노출">
            밈캐치는 원본 파일을 재호스팅하지 않고 플랫폼 공식 임베드만 써요.
            {rights.unknownCount > 0
              ? ` 인용 출처 중 ${rights.unknownCount}건은 권리 확인 전이에요.`
              : evidence.total > 0
                ? " 인용 출처는 전부 임베드 권리를 확인했어요."
                : ""}
          </Row>

          <Row label="문서 상태">
            <StateChip state={state} />{" "}
            {state === "보강 중" && hasDocStatusNote && (
              <a href="#doc-status-title" className="underline underline-offset-2">
                무엇이 부족한지 보기 ↑
              </a>
            )}
          </Row>

          <Row label="수정 이력">
            가장 최근 변경 <time dateTime={updatedAt}>{updated}</time>.
            세부 변경 이력(무엇이 왜 바뀌었는지)은 아직 공개하지 않아요.
          </Row>
        </dl>

        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3">
          {evidence.total > 0 && (
            <a href="#source-evidence-title" className="underline underline-offset-2">
              근거 목록 전체 보기
            </a>
          )}
          <Link
            href={`/submit?name=${encodeURIComponent(title)}`}
            className="inline-flex min-h-11 items-center underline underline-offset-2"
          >
            오류 제보하기
          </Link>
        </div>
      </div>
    </details>
  );
}
```

`page.tsx` 변경은 1:1 치환이다 — `<TrustNote .../>` 호출부를
`<TrustPanel .../>`로 바꾸고 `isThin`(이미 `contentDepth(meme)`로 계산돼 있음.
`DocStatusNote` 바로 위에서 이미 호출 중이므로 결과를 재사용)과
`hasDocStatusNote` 두 값만 새로 넘긴다. `SourceEvidence` 렌더 위치는 그대로 두고
앵커 id(`source-evidence-title`)만 패널의 "근거 목록 전체 보기" 링크 대상으로 쓴다.

---

## 5. 상태별 문구 — 실측 기반 매트릭스

`evidencePhrase()`·`originVerificationPhrase()`는 `TrustNote`의 기존 4분기를
그대로 옮긴 것이다(새 카피 없음, 회귀 테스트도 그대로 이식 가능).

| 근거 상태 | 접힌 요약줄 | 펼친 "원본 확인" 줄 | 실제 예시 |
| --- | --- | --- | --- |
| 0건 | `근거 출처 준비 중` | (행 자체를 생략하거나 "확인된 원본이 없어요") | `e8ferq5u` |
| 맥락만 | `맥락 출처 N개로 확인 — 원본은 아직 찾는 중` | `원본은 아직 못 찾았고, 맥락 자료만 확인했어요` | `3fajbwre`(1건) |
| 맨 URL(서지 없음) | `출처 링크 N개 수집 — 서지 확인 중` | `출처 링크는 있지만 제목·작성자 정보가 없어 원본 여부를 표시하지 못해요` | `ra86attn`(2건), `kecg9kfp`(2건) |
| 서지 확인됨 | `근거 출처 N개 확인 (원본·보도 M개)` | `원본·보도 출처 M개를 제목·작성자와 함께 확인했어요` | `z4ywt995`(5건 전부) |

「권리 노출」 문구의 정적 앞 문장("재호스팅하지 않고 공식 임베드만")은 **모든
문서에 동일**하다 — 문서별 데이터가 아니라 사이트 전체 정책이라서(
`supabase/migrations/20260723120000_source_pipeline.sql:2` 주석에 명시된 설계
원칙). 문서별로 달라지는 건 뒤에 붙는 "인용 출처 권리 확인" 상태뿐이다.

---

## 6. 접기/펼치기 접근성

**네이티브 `<details>`/`<summary>`를 쓴다.** `aria-expanded`를 직접 관리하지
않는다 — 이유는 이미 이 저장소가 같은 선택을 한 전례가 있기 때문이다
(`components/site-footer.tsx:70-78`, 법적 고지 접기).

- `<details>`는 `open` 속성 자체가 접근성 트리의 확장 상태다. Chrome/VoiceOver,
  Firefox/NVDA 조합에서 별도 ARIA 없이 펼침/접힘이 정확히 전달된다 — 수동으로
  `aria-expanded`를 켜고 끄는 `useState`가 필요 없다(상태가 이중으로 존재하면
  둘이 어긋나는 버그의 원인이 된다. `components/explore-filters.tsx:286-291`처럼
  버튼+`aria-expanded` 수동 패턴은 URL 쿼리와 동기화해야 하는 필터에서나 필요하고,
  이 패널은 그런 외부 상태가 없다).
- `<summary>`는 기본으로 키보드 포커스 가능(Tab)하고 Enter/Space로 토글된다 —
  버튼을 새로 만들 필요가 없다(ladder 4단: 네이티브 기능 우선).
- `[&::-webkit-details-marker]:hidden` + 커스텀 `ChevronDown`으로 기본 삼각형
  마커만 숨긴다. 실제 상태 전달은 여전히 `<details>`의 네이티브 시맨틱이 한다 —
  화살표는 시각적 보강일 뿐 접근성 신호가 아니다.
- 최소 탭 타깃 44px(`min-h-11`)은 기존 컴포넌트 전반의 관례(`TrustNote`·
  `SourceEvidence`·`DocStatusNote` 모두 `min-h-11` 사용)를 그대로 따른다.
- 기본 열림/닫힘: **닫힘 기본값**(`open` 속성 생략). LOOP.md §2가 요구하는
  "검수일·근거수·문서상태"는 이미 접힌 `<summary>` 한 줄에 다 들어 있으므로,
  펼치지 않아도 첫 뷰포트 요구사항을 만족한다 — 기본으로 펼쳐서 화면을 채울
  이유가 없다(footer의 `open` 기본값은 법적 고지처럼 항상 노출해야 하는 다른
  이유가 있는 경우였다).
- 열고 닫을 때 GA 이벤트를 새로 붙이지 않는다 — 신규 사용자 데이터 수집 확대는
  `HG-006`이 이미 `HUMAN_GATE`로 못 박은 영역이다. 필요해지면 그 게이트 안에서
  `trust_panel_opened` 하나를 추가 후보로 올리되, 이 루프에서 결정하지 않는다.

---

## 7. 마이그레이션 순서 (구현 시 참고 — 이 루프에서는 코드화하지 않음)

1. `TrustPanel` 신규 작성, `TrustNote`의 기존 테스트 7건을 `evidencePhrase`/
   `originVerificationPhrase` 단위로 그대로 이식(카피가 안 바뀌므로 assertion도
   거의 그대로 옮겨진다).
2. `page.tsx`에서 `<TrustNote>` 호출을 `<TrustPanel>`로 교체 — `isThin`은 이미
   `DocStatusNote` 렌더 직전에 `contentDepth(meme)`로 계산돼 있으니 그 값을
   두 컴포넌트에 같이 넘긴다(계산 중복 없음).
3. `SourceEvidence`·`DocStatusNote`는 헤딩에 `id`가 없으면 앵커 대상이 되도록
   `id="source-evidence-title"`/`id="doc-status-title"`을 붙인다(이미 있음 —
   `source-evidence.tsx:24`, `doc-status-note.tsx:35`. 코드 변경 불필요).
4. `trust-note.tsx`·`trust-note.test.tsx` 삭제는 `TrustPanel` 테스트가 같은
   문구 커버리지를 넘겨받은 뒤에만.
5. 검증: `npx vitest run`(회귀 0건), 390×844/1440×900 접힌 요약줄에 검수일·
   근거수·문서상태 동시 노출 확인, `role=group`(`<details>`의 암묵적 역할)이
   VoiceOver/NVDA에서 펼침 상태를 읽는지 수동 확인.

**되돌리는 방법**: `TrustPanel` import를 `TrustNote`로 되돌리고 `isThin`/
`hasDocStatusNote` prop 전달을 제거하면 된다 — 데이터 변경이 없으므로 롤백은
코드 되돌리기 하나로 끝난다.

---

## 8. 이 루프가 손대지 않는 것 (다음 게이트)

- **`meme_revisions` 실제 노출**: `DQ-010`이 이미 blocked. `editor_id`를 제거한
  안전한 공개 뷰(예: `created_at`, `note`에서 PII 제거 후 요약 문장만) 설계는
  별도 데이터 모델링 루프가 필요하다 — 이 문서는 "지금 노출 가능한 값이 없다"는
  사실과 정직한 폴백 문구까지만 다룬다.
- **`meme_media.source_role` 데이터 자체를 채우는 일**: `DQ-007` 소관. 채워져도
  RLS가 `operator`로 막혀 있는 한 공개 화면에는 여전히 못 쓴다 — RLS 정책 변경은
  이 루프의 소스 수정 금지 범위를 넘어서고, 애초에 "공개해도 되는 열만 고른 뷰"가
  필요해 별도 설계가 맞다.
- **`copyright_status` 6값 taxonomy 전체 노출**: 실사용 값이 2개뿐이라 지금은
  2값 문구로 충분하다. `permission_needed`/`internal_only`가 실제로 쓰이기
  시작하면 그때 문구를 확장한다(YAGNI).
