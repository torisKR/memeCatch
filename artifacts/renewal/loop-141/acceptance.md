# Loop 141 Acceptance — PLUS-056 Route-safe Global Daily Review Shelf

## 사용자 계약

- Global Daily 후보는 기존 localized detail route와 같은 `isIndexableMeme()` source-depth 계약을 통과한 원문만 사용한다.
- Premium Global Daily 완료·already-completed 화면은 공급된 3문항을 원래 순서대로 복습하고, 각 문항의 정답 의미·안전 신호·현재 UI locale의 상세 경로를 제공한다.
- 세 복습 CTA는 각각 `#meme-use-kit-title`로 직접 이어져 해당 밈의 Use Kit을 연다.
- `showReviewShelf`는 Premium에서만 켜며 standalone `/daily`는 기존 첫 문항 handoff를 유지한다.

## 데이터·안전 계약

- 서버 loader는 content depth 계산에 필요한 `usage_note`, `caution`, `usage_examples`, `meme_sources`, `meme_contents`, `meme_tags_map`을 읽는다.
- source가 얇거나 review question 계약이 malformed이면 후보·shelf를 fail-closed한다. malformed Premium shelf에서는 기존 first-only next-step도 노출하지 않는다.
- 기존 reviewed/current 5-locale translation gate, Market Passport, completion/streak semantics는 유지한다.
- 새 DB/API/RPC/schema/migration/write/analytics/AI/publication/deploy는 추가하지 않는다.

## 검수 기준

- 동일 세션 완료, already-completed 재방문, malformed answer index, standalone opt-out, 5개 locale Use Kit href를 회귀 테스트로 확인한다.
- production 데이터·authenticated Plus/RLS·실제 completion write·translation publication·live route 공급·production deploy는 별도 human gate다.
