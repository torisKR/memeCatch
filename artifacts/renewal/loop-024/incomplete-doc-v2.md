# incomplete-doc-v2 — DocStatusNote 4행 확장 설계안

## 왜

`components/doc-status-note.tsx:24-28`는 지금 "무엇이 부족한가"만 나열한다
(`missing` 배열 — 유래/사용 예문/출처). LOOP.md §4(`LOOP.md:36`)는 "무엇이
부족한지"뿐 아니라 완전성의 반대편 — 이미 확인된 것 — 도 보여줄 것을 요구한다.
지금 화면은 얇은 문서를 "결핍 목록"으로만 보여줘서, 그 문서에 실제로 있는
확인된 내용(요약 한 줄, 대표 미디어 등)이 묻힌다.

이 설계는 LOOP.md 요청 형식 그대로 4행을 만든다:
「확인 완료 / 추가 확인 중 / 마지막 검수 / 제보 필요」.

## 원칙 — confirmed는 실데이터에서만

각 행은 `contentDepth()`가 이미 계산해 둔 신호(`lib/content-depth.ts:96-107`
`ContentDepthSignals`) 또는 상세 페이지가 이미 들고 있는 필드에서 **참/거짓
또는 개수를 그대로 읽는다**. 새 판정 로직이나 AI 생성 문구를 추가하지 않는다
(LOOP.md 절대 규칙 4번, `LOOP.md:48` — AI 산출물 자동 공개 금지와 별개로,
이 배너 자체가 AI 판정이 아니라 구조적 존재 여부 체크여야 함).

## 데이터 소스 매핑 (파일:줄 근거)

| 행 | 판정 기준 | 근거 |
|---|---|---|
| 확인 완료 | `meme.summary` 비어있지 않음 | `app/(default)/memes/[key]/page.tsx:97,191` — `meme.summary`가 이미 상세 페이지에 존재, description에도 쓰임 |
| 확인 완료 | `signals.mediaCount >= 1` (대표 미디어 유무) | `lib/content-depth.ts:139-142` `liveMediaCount()` — `isRenderableContent` 통과한 살아있는 콘텐츠 수, `page.tsx:144`에서 이미 `liveContents`로 필터링해 재사용 중인 값과 동일 기준 |
| 확인 완료 | `signals.sourceCount >= 1` | `lib/content-depth.ts:120-129` `distinctSourceCount()` |
| 확인 완료 | `signals.tagCount >= 1` (분류 존재) | `lib/content-depth.ts:107` `tagCount` |
| 추가 확인 중 | `missing` 배열 그대로 재사용 (유래/사용 예문/출처 중 0인 것) | `components/doc-status-note.tsx:25-28` — 새 로직 아님, 기존 계산 재노출 |
| 마지막 검수 | `meme.updated_at` | `app/(default)/memes/[key]/page.tsx:196` (`dateModified={meme.updated_at}`), 날짜 포맷은 `components/trust-note.tsx:32-39`의 `toLocaleDateString("ko-KR", …)` 패턴 그대로 재사용 |
| 제보 필요 | `missing.length > 0` 이면 항상 노출 (현재 CTA 로직 그대로) | `components/doc-status-note.tsx:56-61` `/submit?name=` 링크 |

새로 계산해야 하는 값은 없다 — `mediaCount`·`sourceCount`·`tagCount`는
`contentDepth(meme).signals`에 이미 있고(`lib/content-depth.ts:96-107`),
`updated_at`은 현재 `DocStatusNote`에 넘기지 않는 `meme.updated_at`을
prop으로 추가만 하면 된다 (`TrustNote`가 이미 같은 필드를 받는 전례:
`page.tsx:388-392`).

## Props 변경

```ts
// 기존
{ meme: ContentDepthInput; title: string }

// 확장 — updated_at, summary, tag 표시용 신호 추가
{ meme: ContentDepthInput & { summary?: string | null }; title: string; updatedAt: string }
```

`ContentDepthInput`에 `summary`가 없으므로 얕게 확장한다. `updatedAt`은
`TrustNote`와 동일하게 별도 prop으로 받는다(page.tsx 호출부에서
`meme.updated_at`을 이미 `TrustNote`에 넘기고 있어 한 줄 추가만 필요:
`page.tsx:388-392` 옆에 `DocStatusNote` 호출 `page.tsx:307`도 같은 prop을
추가).

## 4행 레이아웃 (텍스트 초안)

```
✎ 아직 정리 중인 문서예요

● 확인 완료 — 요약, 대표 미디어, 출처 2개        [항목별 유/무만, 참인 것만 나열]
▲ 추가 확인 중 — 유래, 사용 예문                  [missing 배열 그대로]
마지막 검수 2026-07-30                            [meme.updated_at]
「{title}」, 실제로 써 보셨다면 알려 주세요 →      [기존 CTA 문구/링크 유지]
```

- "확인 완료" 행은 참인 항목이 하나도 없으면(요약도 없고 미디어도 없고
  출처도 없고 태그도 없음) 행 자체를 렌더하지 않는다 — 없는 것을 "확인
  완료: 없음"으로 적으면 LOOP.md §4 취지(부족함을 숨기지 않되 정직하게)에
  어긋난다. 대신 "추가 확인 중"에 그 결핍이 이미 드러난다.
- "추가 확인 중"은 `missing.length === 0`이면(즉 유래·예문·출처는 다 있는데
  프로세 총량·점수 하한만 못 넘긴 경우) 현재 fallback 문구
  ("이 문서는 아직 내용을 보강하는 중이에요", `doc-status-note.tsx:45`)를
  그대로 쓴다.
- "마지막 검수"는 `meme.updated_at`을 그대로 쓴다 — 이 값이 사람 검수
  시점이라는 보장은 없고 레코드 갱신 시점이다(자동 배치 갱신 포함 가능).
  라벨을 "마지막 갱신"이 아니라 "마지막 검수"로 쓰려면 실제로 사람 검수가
  일어날 때만 갱신되는 별도 필드가 있어야 하는데, 지금 스키마에 그런 필드가
  없다 — 이 문서에서 확인 가능한 파일 근거 없음. **HUMAN_GATE 필요**: 이
  필드가 없는 채로 "검수"라는 단어를 쓰면 실제로 검수하지 않은 자동 갱신도
  검수로 보이게 되어 LOOP.md 절대 규칙 5번(근거 없이 신뢰 판정 금지)과
  충돌한다. 스키마에 `last_reviewed_at` 같은 필드가 생기기 전까지는 라벨을
  "마지막 갱신"으로 쓰거나, `moderation_status !== "pending"`일 때만
  "검수 완료 상태"라는 별도 문구를 쓰는 대안을 다음 루프에서 결정한다.

## 접근성 · 톤

- 색상 단독 전달 금지(LOOP.md 절대 규칙 8, `LOOP.md:52`) — 기존과 동일하게
  `●`/`▲` 기호 + 텍스트 라벨 병기. 새 행에도 아이콘 없이 텍스트 라벨만
  쓰거나(마지막 검수, 제보 필요는 상태 아님) 동일 기호 체계를 따른다.
- `TrustNote`가 이미 쓰는 "충실도는 여기서 반복하지 않는다"(`trust-note.tsx:17-18`)
  원칙과 충돌하지 않는지 확인 필요: "확인 완료"의 출처 개수가 `TrustNote`의
  출처 확인 문구와 겹친다. 겹침을 피하려면 "확인 완료" 행은 **존재 여부만**
  말하고 개수·품질 판정(원본/맥락 구분 등)은 여전히 `TrustNote` 몫으로 남긴다
  (예: "출처 있음"이라고만 쓰고 "출처 2개 확인, 원본 1개"처럼 `TrustNote`
  문구를 복제하지 않음).

## 미해결 — 다음 루프에서 결정할 것

1. "마지막 검수" 라벨의 근거 필드 부재 (위 HUMAN_GATE 항목).
2. `summary` 필드가 실제로 비어 있는 문서 비율 — 이 설계는 "meme.summary
   비어있지 않음"을 확인 완료 신호로 쓰지만, 이번 조사에서 실제 DB 값을
   조회하지 않았으므로 그 비율에 대한 근거는 없다. 적용 전에
   `meme.summary IS NULL OR meme.summary = ''` 카운트를 프로덕션 읽기 전용
   조회로 확인해야 한다.
