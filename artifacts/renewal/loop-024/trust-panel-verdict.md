# 신뢰 패널 설계안 심판 (루프 024)

> 세 설계안(`trust-panel-reader-first.md`·`trust-panel-operator-first.md`·
> `trust-panel-minimal-diff.md`)을 저장소 소스·프로덕션 스키마와 대조해 채점했다.
> 소스 미수정 — 이 파일 하나만 산출물이다. 인용은 전부 이 세션에서 직접 읽은
> file:line 또는 세 설계안 원문이다.

## 0. 결론

**승자: `trust-panel-reader-first.md`.**

이유를 한 줄로: 셋 다 데이터 실측은 정확했지만(§1), **reader-first만 새 패널을
`TrustNote`의 대체물로 만들어 "같은 사실이 화면 두 곳에 다른 문구로 남는" 문제를
구조적으로 없앴다.** 나머지 둘은 `TrustNote`를 그대로 둔 채 패널 안에 근거 수·
업데이트일을 **새 문구로 다시 계산해** 넣어, 정확히 `trust-note.tsx:17-18`의
자기 경고("같은 사실을 두 번 쓰면 둘 다 배경이 된다")를 어긴다 — 두 설계 모두
다른 항목(DocStatusNote↔isThin 관계)에서는 이 원칙을 인용하면서 자기 패널
설계에는 적용하지 못했다(§3).

## 1. 데이터 실측 대조 — 셋 다 정확했다

세 문서가 공통으로 인용한 근거를 직접 재확인했다.

| 주장 | 실측 결과 | 세 문서 일치 여부 |
| --- | --- | --- |
| `meme_media`/`media_sources`/`meme_claims`는 anon 키로 전부 0행(운영자 전용 RLS) | `supabase/migrations/20260723120000_source_pipeline.sql:153-158` — `for all using (is_operator())` 3개 정책 확인 | ✅ 3개 문서 동일 |
| `meme_revisions`도 anon 키로 0행 | `supabase/migrations/20260708004500_schema_v2.sql:553` `revisions_operator ... using (is_operator() or editor_id = auth.uid())` — anon은 `auth.uid()`가 없어 둘 다 거짓 | ✅ 3개 문서 동일 |
| `meme_sources`는 공개 읽기(소속 밈이 approved/limited면) | `20260708004500_schema_v2.sql:526-527` `sources_public_read` 정책 확인 | ✅ 3개 문서 동일 |
| `copyright_status` 실사용 값은 `embeddable`/`unknown` 2개뿐 | `lib/database.types.ts`·`lib/actions/admin-sources.ts:184`에서만 참조, 사용자 화면 0곳(grep 재확인) | ✅ 3개 문서 동일 |
| `MODERATION_STATUS.approved`에 `user` 라벨이 없음 | `lib/labels.ts:28` `approved: { admin: "게시됨", token: "mod-approved" }` — `user` 키 부재 확인 | operator-first만 명시적으로 지적(§6-2), 다른 둘은 새 문자열을 그냥 씀 |

세 문서 모두 "DQI 숫자를 노출하지 않는다"는 과업 제약을 지켰고(`contentDepth().score`를
어디에도 바인딩하지 않음), 없는 테이블(`meme_media`·`meme_revisions`)을 실제 있는 것처럼
쓰지 않았다. **기준 (a)의 "없는 데이터 표시" 위반은 셋 다 없다.** 아래는 그보다 미묘한
정직성 문제다.

## 2. 기준 (a) 정직성 — 문서별 결함

### 2-1. `copyright_status` = "권리 확인" 프레이밍 — reader-first·operator-first 둘 다 과장

`lib/actions/admin-sources.ts:184`를 보면 실제 코드는:

```ts
copyright_status: linkOnly ? "unknown" : "embeddable",
```

`embeddable`은 **저작권 검증 결과가 아니라 "관리자가 공식 임베드를 게시했는가"의
이분값**이다(minimal-diff §1이 이 코드를 직접 인용해 밝힘). 그런데:

- reader-first §4: "인용 출처는 전부 **임베드 권리를 확인했어요**"
- operator-first §4: `embeddable` → "**임베드 권리 확인됨** {n}건"

둘 다 "권리를 확인했다"고 단정한다. 실제로는 "확인"이 아니라 "게시 여부"다.
LOOP.md 절대규칙 4(없는 사실 자동 공개 금지)와 같은 결의 문제 — **법적 확인
절차가 없는데 확인됐다고 말하는 셈**이다. minimal-diff §4.4만 이 구분을 지켜
"공식 임베드로 게시했어요"(관찰 사실)로 쓰고 "확인 완료류 법적 단정을 쓰지
않는다"고 명시적으로 경계했다(§4.4 본문).

**→ reader-first가 승자로 채택되더라도 이 문구는 구현 전에 minimal-diff §4.4의
관찰-사실형 문구로 교체해야 한다.** (아래 §6 이식 목록 1번)

### 2-2. minimal-diff 자체의 결함 — `primary`와 `identifiedPrimary` 혼용

minimal-diff §4.2 "근거 출처 수와 역할" 표:

```
`primary > 0` → `{total}개 (원본·보도 {primary} · 맥락 {context})`
```

여기서 쓰는 값은 `evidence.primary`다. 그런데 `lib/source-links.ts:80-92`의
타입 주석이 명확히 구분한다 — `primary`는 위키가 아닌 모든 출처(서지 유무 무관),
`identifiedPrimary`는 그중 제목·작성자가 있는 것만이다. 루프 023 전수 확인으로
`meme_sources`의 **62.4%가 제목·작성자 둘 다 null인 맨 URL**이다
(`lib/source-links.ts:87-90` 주석, `trust-note.tsx:61-62` 동일 인용).

`trust-note.tsx:83-89`(현재 프로덕션 코드)는 이미 이 실수를 피하려고
`identifiedPrimary`만 "원본·보도"라고 부른다. 그런데 minimal-diff의 같은 패널
안 §4.3 "원본 확인 여부" 행은 정확히 `identifiedPrimary`를 써서 "원본 링크는
있지만 **서지 확인 전**"이라고 말한다. 결과: **같은 패널의 두 줄이 서로 모순한다**
— "근거 출처" 줄은 "원본·보도 5개"(맨 URL도 포함해 셈)라고 하고, 바로 아래
"원본 확인" 줄은 "아니오, 서지 확인 전"이라고 한다. 사용자가 같은 화면에서
상충하는 두 문장을 보게 된다. 이건 reader-first/operator-first의 "권리 확인"
과장보다 심각하다 — **외부 사실 대비 과장이 아니라 패널 내부 자기모순**이기
때문이다.

**→ minimal-diff가 이식 대상으로 채택되는 부분(§6)에서 `primary`를
`identifiedPrimary`로 바꿔야 한다.**

### 2-3. reader-first — z4ywt995 사례가 (a)와 (b) 모두에 기여하는 핵심 근거

reader-first §3의 실측 비교표가 이 채점에서 가장 값진 단일 증거다:

| short_id | moderation_status | isThin | 근거 출처 |
| --- | --- | --- | --- |
| `z4ywt995`(임효준 귀화 논란) | approved | **true**(산문 237자 < 250 하한) | 5개 **전부 서지 확인** |

근거 5개가 전부 서지까지 확인됐는데도 `isThin=true`다 — 근거 수와 문서 충실도가
독립 축이라는 뜻이다. 이 사례는 operator-first의 "확인 완료 · 보강 중" **병기**
설계(§4 문서 상태 표)가 위험하다는 걸 구체적으로 보여준다 — "확인 완료"라는
단정과 "보강 중"이라는 경고를 나란히 붙이면, 독자는 "이미 끝났고 살만 붙이는 중"
으로 오독하기 쉽다. reader-first(§3)와 minimal-diff(§4.1)는 둘 다 `isThin`이
`moderation_status` 라벨을 **대체**하도록 설계해 이 오독 가능성을 없앴다 —
operator-first만 병기를 택했다.

## 3. 기준 (b) 중복 정리 명확성 — 여기서 승부가 갈렸다

세 문서가 공통으로 인용하는 원칙이 있다 — `trust-note.tsx:17-18`:

> "충실도('보강 중')는 바로 위 DocStatusNote가 이미 크게 말하고 있어 여기서
> 반복하지 않는다. **같은 사실을 두 번 쓰면 둘 다 배경이 된다.**"

세 문서 모두 이 원칙을 `DocStatusNote`와의 관계에서는 지킨다(패널의 "문서 상태"
칩이 "보강 중"이면 문장을 새로 안 쓰고 `#doc-status-title`로 위임 — 셋 다 동일).
**그런데 `TrustNote`와의 관계에서는 갈린다:**

| | `TrustNote` 처리 | 패널 안 근거요약 문구 | 결과 |
| --- | --- | --- | --- |
| reader-first | **삭제, 패널이 흡수**(§0) | 패널의 접힌 `<summary>`가 곧 옛 `TrustNote`의 계산 결과(`evidencePhrase`) — 화면에 한 곳만 존재 | 중복 0 |
| operator-first | **그대로 유지**(§2, 0줄 변경) | `EvidenceBreakdown`이 같은 `summarizeEvidence()` 값으로 **새 문장**("아직 연결된 출처가 없어요" 등, §4)을 또 만든다 | 같은 사실이 화면 두 곳에 다른 문구로 존재 |
| minimal-diff | **그대로 유지**(§2, 0줄 변경) | `describeEvidenceCount`가 같은 값으로 **새 문장**("아직 없음" 등, §4.2)을 또 만든다 | 같은 사실이 화면 두 곳에 다른 문구로 존재 |

operator-first는 자기 결론(§0)에서 "셋이 이미 하는 말을 반복하지 않고, 셋 중
누구도 지금 말하지 않는 사실만 추가한다"고 명시했지만, §3 JSX의 실제
`PanelRow` 목록은 "마지막 검수일"·"근거 출처"를 포함한다 — 둘 다 `TrustNote`가
**이미 같은 자리 근처에서** 말하는 값이다(`page.tsx:388-393` 호출부가 패널
바로 위에 남는다는 걸 §3 스스로도 전제한다). **결론과 실제 스케치가 어긋난다.**
minimal-diff는 이런 자기모순적 결론 문구는 없지만(§2 "위임형" 대신 "흡수"라고만
표현), 실질적으로 같은 패턴(TrustNote 존치 + 패널 안 재계산·재문구화)을 보인다.

이 프로젝트가 "1인 운영"을 최우선 제약으로 못 박은 이유(`LOOP_STATE.md:21`)를
감안하면, 문구 하나를 바꿀 때 두 컴포넌트를 함께 고쳐야 하는 구조는 정확히
피해야 할 유지보수 부채다 — reader-first만 이 부채를 원천적으로 없앤다.

## 4. 기준 (c) 1인 운영 유지보수 비용

| | 1회 이관 비용 | 장기 유지 비용 |
| --- | --- | --- |
| reader-first | 가장 큼 — `trust-note.tsx` 삭제, 테스트 7건 이관, `page.tsx`에 신규 prop 2개(`isThin`, `hasDocStatusNote`) 배선(§7 마이그레이션 순서 5단계) | **가장 작음** — 근거·상태 문구가 한 곳에만 존재. 문구 변경 시 파일 1개만 고치면 됨 |
| operator-first | 중간 — 신규 파일 1개 + `summarizeRights()` 신규 함수 + `MODERATION_STATUS.approved.user` 라벨 추가(§6, 스스로 인정한 선행 작업 2건) | **가장 큼** — TrustNote·Panel 두 곳의 근거 문구를 계속 동기화해야 함. 게다가 `"use client"` + 수동 `aria-expanded`(§5)로 향후 ARIA 동기화 버그 표면적이 늘어남 — 이 저장소는 루프 016에서 정확히 이 종류의 수동 ARIA 실수(`aria-label`을 generic role에 사용)를 실제로 낸 전례가 있다(`LOOP_STATE.md:341-345`) |
| minimal-diff | **가장 작음** — 신규 파일 1개, `page.tsx` 변경은 `<SourceEvidence>` 호출 위치를 옮기는 것뿐(§3 diff 6줄) | 중간 — TrustNote와 패널 근거 문구가 여전히 별도 존재(§3 위와 동일한 이유)하지만, 새 함수 없이 기존 `summarizeEvidence`/`contentDepth` 그대로 사용해 계산 로직 자체의 이원화는 없음 |

operator-first §5는 `<details>`를 쓰지 않는 이유로 "브라우저 기본 삼각형
마커만 표시돼 디자인 토큰(▸/▾)을 못 쓴다"고 적었는데, 이는 **이 저장소
자체의 반례로 틀렸다** — `components/site-footer.tsx:70-78`이 정확히
`[&::-webkit-details-marker]:hidden` + 커스텀 `ChevronDown`으로 마커를 감추고
있고, reader-first·minimal-diff 둘 다 같은 클래스를 그대로 인용해 쓴다.
operator-first가 인용한 근거(§5 "이 저장소에 두 전례가 있다")는 있지만, **그중
하나(`<details>`가 커스텀 아이콘을 못 쓴다)에 대한 판단 자체가 사실과 다르다.**
이 오판 때문에 굳이 필요 없는 `"use client"` + `useState` + 수동
`aria-expanded`/`aria-controls`를 도입한 것이 §4의 결론이다 — ladder 4단
("네이티브 기능이 이미 커버하면 그것을 쓴다")에 반한다.

## 5. 기준 (d) 접근성

reader-first·minimal-diff는 둘 다 네이티브 `<details>/<summary>`를 선택했고,
동일한 저장소 전례(`site-footer.tsx:70-78`)를 정확히 인용했다. 클라이언트
JS 0, `aria-expanded`를 브라우저가 자동으로 관리(HTML-AAM 명세, 두 문서 모두
언급). 기본 닫힘 상태에서도 자식 DOM이 남아 색인에 영향 없음(둘 다 명시).

operator-first는 §5에서 `aria-controls`를 `ReportButton`(`components/comments.tsx:236-238`
직접 확인 — `aria-expanded`만 있고 `aria-controls` 없음)에는 없던 요소로 **추가
제안**한 것은 WCAG 4.1.2 관점에서 실제로 개선이다. 다만 위 §4에서 지적한 대로
그 선택의 전제(`<details>`가 커스텀 아이콘을 못 쓴다)가 틀렸고, 수동 ARIA는
이 저장소가 이미 한 번 실패한 패턴이라(§4) 순수 접근성 결과는 동등해도 **유지
가능성 관점에서 열세**다.

세 문서 모두 최소 탭 타깃 44px(`min-h-11`)을 기존 관례대로 지켰고, 아이콘을
`aria-hidden`으로 처리했다. 접근성 자체의 최종 결과물 품질은 셋 다 준수하지만,
reader-first/minimal-diff가 **더 적은 코드로 더 검증된 패턴**을 쓴다는 점에서
근소하게 우위.

## 6. 패자에서 이식할 아이디어

승자(reader-first)를 구현할 때 반드시 반영해야 할 것:

1. **권리 노출 문구는 minimal-diff §4.4를 그대로 쓴다.** "권리를 확인했어요"
   대신 "공식 임베드로 게시했어요"/"링크로만 연결했어요"류 관찰-사실형 문구로
   교체(§2-1 근거). `copyright_status`가 법적 검증이 아니라 게시 여부의
   부산물이라는 minimal-diff §1의 코드 추적(`admin-sources.ts:184`)이 이
   설계 전체에서 가장 근거가 탄탄한 단일 발견이다.
2. **`aria-controls`를 패널 트리거에 추가한다.** operator-first §5가 옳게
   지적했듯 `useId()`로 발급한 id를 details 자체가 아니라 (details를 쓰더라도)
   패널 콘텐츠 wrapper에 달아 WCAG 4.1.2를 더 엄격히 만족시킬 수 있다 — 다만
   네이티브 `<details>`에서는 브라우저가 이미 관계를 표현하므로 필수는 아니고
   가산점 수준.
3. **`MODERATION_STATUS.approved.user` 라벨 신설을 선행 작업 목록에 명시한다.**
   operator-first §6이 유일하게 이 빈 칸(`lib/labels.ts:28`)을 미리 지적했다 —
   reader-first·minimal-diff는 새 문자열을 그냥 인라인으로 썼는데, 기존
   `MODERATION_STATUS.limited.user`("출처 확인 중")와 나란히 두려면 같은
   객체에 `user` 키를 추가하는 편이 다음 사람이 두 상태 라벨을 한 곳에서
   찾을 수 있어 더 낫다.
4. **`identifiedPrimary`/`primary` 구분을 패널 전체에서 일관되게 쓴다.**
   minimal-diff §4.2의 실수(§2-2)가 반면교사다 — "원본·보도"라는 말은 항상
   `identifiedPrimary`에만 붙인다. reader-first 원안은 이미 이 구분을 지켰으니
   구현 시 회귀 테스트로 고정한다(예: "맨 URL 5건을 원본·보도로 표시하지
   않는다" 케이스).

## 7. 승자안(reader-first) 구현 전 고쳐야 할 것

- §2-1의 "권리를 확인했어요" 문구를 §6-1 대체 문구로 교체.
- `summarizeRights()`는 §4 JSX에서 호출만 되고 본문이 없다(세 문서 모두 동일 —
  설계 문서 단계라 구현 미포함은 허용 범위) → 다음 루프에서 `lib/source-links.ts`에
  실제로 추가할 때 §6-1 문구 기준으로 작성.
- `hasDocStatusNote` prop은 `DocStatusNote`가 같은 `isThin` 값으로 렌더됐는지를
  호출부(`page.tsx`)가 보장해야 한다(§4 주석에 명시돼 있으나, 구현 시
  "renders `DocStatusNote`" 여부를 별도로 계산하지 말고 `isThin` 값 자체를
  그대로 불리언으로 재사용할 것 — 두 값이 어긋나면 존재하지 않는 앵커로
  링크가 걸린다).

## 8. 표결 요약

| 기준 | 1위 | 2위 | 3위 |
| --- | --- | --- | --- |
| (a) 정직성 | reader-first (권리 문구 1건 과장, 자기모순 없음) | operator-first (권리 문구 동일 과장) | minimal-diff (권리 문구는 최선이나 근거요약 자기모순 1건) |
| (b) 중복 정리 명확성 | **reader-first (구조적으로 중복 0)** | minimal-diff | operator-first (결론과 실제 스케치 불일치) |
| (c) 유지보수 비용 | minimal-diff (최소 diff) | reader-first (diff는 크나 장기 부채 0) | operator-first (문구 이원화 + 불필요한 client JS) |
| (d) 접근성 | reader-first / minimal-diff 동률(네이티브, 저장소 검증된 전례) | — | operator-first (근거 서술 오류, 수동 ARIA 재도입) |

**총평 1위: reader-first.** (b)에서 결정적으로 앞서고 (a)(d)에서도 근소 우위,
(c)의 1회 이관 비용은 크지만 장기 유지비가 가장 낮다는 점이 1인 운영 기준에서
더 중요하다고 판단했다.
