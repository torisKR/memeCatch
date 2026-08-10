# Loop 126 acceptance — PLUS-046 Next Move in-place One-Cut activation

## 목표

ratings가 고른 Next Move를 상세 Use Kit 링크에서 멈추지 않고, 현재 One-Cut Action Inbox의 첫
카드로 바로 옮겨 구독자가 추천을 즉시 실행할 수 있게 한다.

## 수용 조건

- [x] `mode="one_cut"`이고 Next Move 후보가 현재 Action Inbox에 존재할 때만 activation button을
  제공한다.
- [x] Creator Pack 준비/재사용, pending receipt, busy 상태에서는 현재 작업을 보존하고 기존
  상세 link를 유지한다.
- [x] activation 후 후보가 첫 ActionCard가 되고 include-more/example 선택이 초기화된다.
- [x] activation 완료 상태는 live status로 읽히고 첫 카드에 keyboard focus가 이동한다.
- [x] full inbox, empty/saved-revisit, completed, unavailable에서는 기존 detail Use Kit fallback을
  유지한다.
- [x] reviewed/current/rating/entitlement/RLS 및 no-new-write 경계를 바꾸지 않는다.

## 기준선

기존 `PlusNextMove` ready CTA는 항상 `#meme-use-kit-title` 상세 링크였다. ratings 기반 후보를
현재 Action Inbox 첫 카드로 재배치하는 client interaction은 없었다.

## 범위 밖

authenticated Plus populated `/premium` 브라우저 session, payment/entitlement/receipt production
write, live translation supply/publication, production deploy는 실행하지 않았다. local browser는
`/login?next=%2Fpremium`에서 인증이 필요했고, credentials/OTP/우회는 사용하지 않았다.

## 관련 결정

- `docs/renewal/BACKLOG.md` — PLUS-046
- `docs/renewal/DECISIONS.md` — D-072
- `docs/renewal/LOOP_STATE.md` — 루프 126
