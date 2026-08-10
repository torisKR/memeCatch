# Loop 125 acceptance — PLUS-045 Daily Signal focused One-Cut

## 목표

Plus Daily Signal 이메일에서 검수된 후보를 읽는 데서 끝나지 않고, 오늘 실행할 One-Cut을
`/premium`에서 바로 열도록 연결한다. 로그인 전후에도 후보 focus와 발송 locale을 잃지 않고,
완료되었거나 더 이상 eligible하지 않은 후보는 안전하게 기존 Action Inbox 순서로 돌아가야 한다.

## 수용 조건

- [x] 이메일 text/HTML CTA가 detail-only URL 대신 `/premium?focus=...&locale=...&from=daily_signal`을 사용한다.
- [x] focus id는 `[A-Za-z0-9_-]{1,128}` 경계에서만 허용된다.
- [x] 명시된 Daily Signal locale은 `ko`, `en`, `ja`, `zh`, `zh-tw`만 통과한다.
- [x] Premium은 실제 eligible Action Inbox에 존재하는 동일 `memeId`만 첫 One-Cut으로 승격한다.
- [x] unknown, stale, unsafe, completed focus는 기존 deterministic ordering으로 fallback한다.
- [x] Premium은 이메일의 명시 locale을 우선해 Daily Signal과 action facts의 locale을 일치시킨다.
- [x] proxy login redirect는 전체 query를 safe `next` 안에 보존하고 원래 query를 중복 전달하지 않는다.
- [x] ready/prepared/receipt 퍼널 이벤트는 기존 analytics contract를 사용하며 PII, URL, receipt id,
  private note, 사용자 원문을 payload에 넣지 않는다.
- [x] reviewed/current exact-locale/no-fallback, entitlement/RLS, 기존 export/receipt와 human
  translation publication 경계를 변경하지 않는다.
- [x] 새 DB/API/RPC/schema/migration/payment/AI generation/publication write를 추가하지 않는다.

## 범위 밖

실제 고객의 authenticated Plus/RLS/결제/receipt write, 실제 Daily Signal relay 수신, production
번역 publication, production deploy는 실행하지 않았다. `translation:check`의 기존 448/1,520
artifact와 누락 1,072행은 별도 human gate다.

## 관련 결정

- `docs/renewal/BACKLOG.md` — PLUS-045
- `docs/renewal/DECISIONS.md` — D-071
- `docs/renewal/LOOP_STATE.md` — 루프 125
