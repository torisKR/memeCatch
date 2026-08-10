# Loop 140 Acceptance — PLUS-055 Premium Global Daily 3-Meme Review Shelf

## 사용자 계약

- active Premium의 Global Daily가 같은 세션에서 완료되거나 이미 `completed` 상태로 재방문되면, 기존에 공급된 3문제를 원래 순서대로 모두 복습할 수 있다.
- 각 복습 항목은 해당 문항의 제목, `options[answerIndex]` 정답 의미, 안전 신호, 현재 UI locale의 정확한 상세 경로를 제공한다.
- 기존 첫 문항의 Market Passport와 첫 문항 Use Kit handoff는 유지한다.
- `ready` 미완료, 진행 중, signed-out, locked, unavailable 상태에는 복습 shelf를 표시하지 않는다.
- standalone `/daily`는 `showReviewShelf`를 전달하지 않아 기존 완료 화면을 유지한다.

## 데이터·안전 계약

- Global Daily loader/builder가 잘못된 `answerIndex` 또는 불완전한 문제 계약을 발견하면 질문 목록을 fail-closed하고 `unavailable` 경로로 닫는다.
- 복습 shelf도 동일한 검증을 다시 적용해 malformed question을 빈 의미 텍스트로 노출하지 않는다.
- 새 DB 조회, API, RPC, migration, persistence write, AI 호출, analytics event, dependency, publication, deployment는 추가하지 않는다.
- 기존 reviewed/current/safety-gated 3문제 공급, completion/streak semantics, Passport read 경계를 변경하지 않는다.

## 검수 기준

- 같은 세션 완료와 already-completed 재방문에서 3개 항목·순서·뜻·안전 신호·Use Kit을 확인한다.
- ko/en/ja/zh/zh-tw 다섯 locale의 상세 href를 확인한다.
- 44px touch target, 고유 heading id, 충돌 없는 list key를 확인한다.
- Premium page의 `showReviewShelf` opt-in과 standalone opt-out을 확인한다.
