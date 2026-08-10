# Loop 107 acceptance — PLUS-032 One-Cut Outcome Follow-Up

## 목표

Plus 대시보드가 활용 완료 뒤 `성과 입력 대기` 수치만 보여주고 실제 성과 메모·hit/neutral/miss
입력을 숨기는 dead end를 닫는다. 사용자는 추천 → 사용 기록 → 결과 회고 → 다음 추천 학습의
닫힌 루프를 한 화면에서 이어갈 수 있어야 한다.

## 범위

- 실제 Premium 대시보드가 사용하는 `one_cut` Action Inbox에 기존 `PlusOutcomeFollowUp`을 노출한다.
- 기존 owner-scoped performance/rating API, privacy copy, 5개 locale copy, Next Move callback을 재사용한다.
- `outcomeFollowUps.status === "ready"`일 때만 노출하고 locked/empty/unavailable에는 새 UI를 만들지 않는다.
- full inbox 모드의 기존 7일 요약과 follow-up 동작, one-cut 추천·Creator Pack·receipt 순서는 유지한다.
- 새 DB/API/schema/dependency, 자동 게시, production write는 추가하지 않는다.

## 완료 기준

1. one-cut + pending follow-up에서 성과 메모와 hit/neutral/miss 컨트롤이 실제 DOM에 보인다.
2. one-cut follow-up이 완료 receipt 이후에 렌더되고, existing APIs/callbacks를 사용한다.
3. one-cut의 locked/empty/unavailable과 default inbox 회귀 경계를 유지한다.
4. focused/full test, typecheck, lint, build, local route QA와 독립 리뷰를 통과한다.
