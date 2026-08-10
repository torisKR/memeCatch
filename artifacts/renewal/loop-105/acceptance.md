# Loop 105 acceptance — PLUS-031 One-Cut Recommendation First

## 목표

구독자가 Plus 대시보드에서 무엇을 쓸지 먼저 이해한 뒤, 기존 게시용 카드·캡션 준비와 실제 사용 기록으로 이어지게 한다. 현재 one-cut은 Creator Pack 버튼과 준비 상태가 추천 카드보다 먼저 렌더되어, 결과 약속의 순서가 뒤집혀 있다.

## 범위

- `PlusGlobalActionInbox`의 `one_cut` 모드에서 추천 `ActionCard`를 Creator Pack 준비 CTA보다 먼저 렌더한다.
- 추천 카드의 exact reviewed/current 데이터, 제목·요약·locale href, 복사·공유·receipt 동작은 유지한다.
- Creator Pack export/preview, compact receipt, completion API/RPC, analytics payload, 5개 핵심 locale 문구와 empty/unavailable 상태는 변경하지 않는다.
- 새 DB table, migration, API, dependency, production write는 추가하지 않는다.

## 완료 기준

1. active one-cut에서 DOM/시각 순서가 `추천 밈 → 게시 카드 준비 → 준비 결과 → 활용 기록`이다.
2. 추천 밈이 없거나 result가 unavailable이면 기존 empty/unavailable 상태만 보인다.
3. 기존 Creator Pack 준비·preview·receipt 회귀 테스트가 통과하고, 추천 카드가 CTA보다 앞선다는 회귀 테스트가 추가된다.
4. typecheck, lint, full test, production build, local HTTP에서 변경 범위를 확인한다.
